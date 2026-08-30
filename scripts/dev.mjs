/**
 * Full dev stack: server → health check → Vite + Electron.
 *
 * Avoids ECONNREFUSED proxy noise by waiting for the backend before
 * starting the frontend processes. On Windows, also frees a stale server
 * on SERVICE_PORT / VITE_PORT (from service-ports.mjs) from a previous session.
 *
 * Auto-restarts the Python server on crash or repeated health-check failure
 * (common on Windows after WinError 64 / sleep / VPN) so Vite does not sit
 * behind a dead proxy returning Bad Gateway.
 *
 * Spawns Vite/Electron directly (not via npm run) so Ctrl+C shutdown
 * does not print "exited with signal SIGINT" from nested npm wrappers.
 * On stop, Vite/Electron are force-killed; the FastAPI child gets a short
 * grace window so lifespan can disconnect Telegram before taskkill /F.
 */

import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import {
  freePort,
  HEALTH_URL,
  killProcessTree,
  prepareDevPorts,
  SERVICE_PORT,
  stopProcessTreeGracefully,
  VITE_PORT,
  waitForServer,
} from "./dev-utils.mjs";

/** Grace window for FastAPI lifespan (scheduler + Telegram disconnect) before force-kill. */
const SERVER_STOP_GRACE_MS = 5_000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const webOnly = process.argv.includes("--web-only");

/**
 * Windows: empty System32 `node` / `npm` stubs (0-byte) can shadow a real Node
 * install (e.g. nvm4w\\nodejs). Warn only — do not try to delete (needs admin).
 */
function warnBrokenNodeNpmOnPath() {
  if (process.platform !== "win32") return;
  const system32 = process.env.SystemRoot
    ? path.join(process.env.SystemRoot, "System32")
    : "C:\\Windows\\System32";
  const stubs = ["node", "node.exe", "npm", "npm.cmd", "npm.exe"];
  const broken = [];
  for (const name of stubs) {
    const stubPath = path.join(system32, name);
    try {
      const st = fs.statSync(stubPath);
      if (st.isFile() && st.size === 0) broken.push(stubPath);
    } catch {
      // absent — fine
    }
  }
  if (broken.length === 0) return;
  console.warn(
    `[dev] WARNING: empty Windows stubs can shadow real Node/npm on PATH:\n` +
      broken.map((p) => `  - ${p}`).join("\n") +
      `\n[dev] Remove those stubs (admin) or put real Node first (e.g. nvm4w\\\\nodejs). ` +
      `This script uses process.execPath for Vite/Electron and does not delete stubs.`,
  );
}

const MAX_SERVER_RESTARTS = 5;
const HEALTH_WATCH_INTERVAL_MS = 30_000;
const HEALTH_FAIL_THRESHOLD = 3;

/** @type {import("node:child_process").ChildProcess[]} */
const children = [];
let shuttingDown = false;
/** @type {Promise<void> | null} */
let shutdownPromise = null;
let restartingServer = false;
let serverRestartCount = 0;
let consecutiveHealthFails = 0;
/** @type {import("node:child_process").ChildProcess | null} */
let server = null;

function resolvePackageFile(workspaceDir, packageName, ...relativePath) {
  const require = createRequire(path.join(workspaceDir, "package.json"));
  const packageJson = require.resolve(`${packageName}/package.json`);
  return path.join(path.dirname(packageJson), ...relativePath);
}

function spawnVite() {
  const webDir = path.join(projectRoot, "web");
  const viteBin = resolvePackageFile(webDir, "vite", "bin", "vite.js");
  return spawn(process.execPath, [viteBin], {
    cwd: webDir,
    stdio: ["ignore", "inherit", "inherit"],
  });
}

function spawnElectron() {
  const desktopDir = path.join(projectRoot, "desktop");
  const tscBin = resolvePackageFile(desktopDir, "typescript", "lib", "tsc.js");

  const compile = spawnSync(process.execPath, [tscBin], {
    cwd: desktopDir,
    stdio: "inherit",
  });
  if (compile.status !== 0) {
    console.error("\n[dev] ERROR: desktop TypeScript compile failed");
    process.exit(1);
  }

  const require = createRequire(path.join(desktopDir, "package.json"));
  const electronPath = require("electron");

  return spawn(electronPath, [path.join(desktopDir, "dist", "main.js"), "--dev"], {
    cwd: desktopDir,
    stdio: ["ignore", "inherit", "inherit"],
  });
}

/**
 * Stop Vite/Electron immediately; give the Python server a grace window so
 * lifespan can finish (avoids Windows KeyboardInterrupt traceback spam).
 * Re-entrant: a second Ctrl+C awaits the in-flight stop instead of force-exiting early.
 */
async function cleanup() {
  if (shutdownPromise) {
    await shutdownPromise;
    return;
  }

  shuttingDown = true;
  shutdownPromise = (async () => {
    console.log("\n[dev] Stopping…");

    for (const child of children) {
      killProcessTree(child);
    }

    if (server) {
      await stopProcessTreeGracefully(server, { gracefulMs: SERVER_STOP_GRACE_MS });
      server = null;
    }
  })();

  await shutdownPromise;
}

async function shutdown(exitCode = 0, errorMessage) {
  await cleanup();
  if (errorMessage) {
    console.error(errorMessage);
  }
  console.log("[dev] Stopped.");
  process.exit(exitCode);
}

function spawnServerProcess() {
  // Use uv so dev matches pyproject.toml (system `python` may have incompatible packages).
  return spawn("uv", ["run", "python", "-m", "server"], {
    cwd: projectRoot,
    stdio: ["ignore", "inherit", "inherit"],
    env: {
      ...process.env,
    },
  });
}

async function restartServer(reason) {
  if (shuttingDown || restartingServer) return;
  if (serverRestartCount >= MAX_SERVER_RESTARTS) {
    await shutdown(1, `\n[dev] ERROR: ${reason}; max server restarts (${MAX_SERVER_RESTARTS}) reached`);
    return;
  }

  restartingServer = true;
  serverRestartCount += 1;
  console.warn(
    `\n[dev] ${reason}; restarting server (${serverRestartCount}/${MAX_SERVER_RESTARTS})...`,
  );

  if (server) {
    await stopProcessTreeGracefully(server, { gracefulMs: SERVER_STOP_GRACE_MS });
    server = null;
    await sleep(500);
  }

  await freePort(SERVICE_PORT);
  server = spawnServerProcess();
  attachServerHandlers(server);

  const ready = await waitForServer();
  restartingServer = false;

  if (!ready) {
    await shutdown(1, "\n[dev] ERROR: Server not ready after restart");
    return;
  }

  consecutiveHealthFails = 0;
  console.log("[dev] Server back online");
}

function attachServerHandlers(proc) {
  proc.on("error", (err) => {
    if (shuttingDown) return;
    void restartServer(`Failed to start server: ${err.message}`);
  });

  proc.on("exit", (code, signal) => {
    if (shuttingDown || restartingServer) return;
    const detail = signal ? `signal ${signal}` : `code ${code ?? "unknown"}`;
    void restartServer(`Server exited unexpectedly (${detail})`);
  });
}

function startHealthWatchdog() {
  setInterval(() => {
    if (shuttingDown || restartingServer) return;
    void (async () => {
      try {
        const resp = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(5000) });
        if (!resp.ok) throw new Error(String(resp.status));
        consecutiveHealthFails = 0;
      } catch {
        consecutiveHealthFails += 1;
        if (consecutiveHealthFails >= HEALTH_FAIL_THRESHOLD) {
          consecutiveHealthFails = 0;
          await restartServer("Health check failed 3 times");
        }
      }
    })();
  }, HEALTH_WATCH_INTERVAL_MS);
}

warnBrokenNodeNpmOnPath();
await prepareDevPorts();

console.log("[dev] Starting FastAPI server...");
server = spawnServerProcess();
attachServerHandlers(server);

console.log("[dev] Waiting for server health");
const ready = await waitForServer();
if (!ready) {
  console.error("\n[dev] ERROR: Server not ready within 90 seconds");
  killProcessTree(server);
  process.exit(1);
}
console.log("\n[dev] Server ready");

await freePort(VITE_PORT);

if (webOnly) {
  console.log("[dev] Starting Vite...");
  children.push(spawnVite());
} else {
  console.log("[dev] Starting Vite + Electron...");
  children.push(spawnVite(), spawnElectron());
}

startHealthWatchdog();

process.on("SIGINT", () => {
  void shutdown(0);
});
process.on("SIGTERM", () => {
  void shutdown(0);
});

for (const child of children) {
  child.on("exit", (code) => {
    if (shuttingDown) return;
    void shutdown(code ?? 0);
  });
}

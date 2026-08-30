/**
 * Shared helpers for dev startup scripts.
 */

import { execSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { HEALTH_URL, SERVICE_PORT, VITE_PORT } from "./service-ports.mjs";

export { HEALTH_URL, SERVICE_PORT, VITE_PORT };
export const MAX_WAIT_MS = 90_000;
export const POLL_INTERVAL_MS = 500;

export async function waitForServer() {
  const deadline = Date.now() + MAX_WAIT_MS;
  while (Date.now() < deadline) {
    try {
      const resp = await fetch(HEALTH_URL);
      if (resp.ok) return true;
    } catch {
      // Server not ready yet
    }
    process.stdout.write(".");
    await delay(POLL_INTERVAL_MS);
  }
  return false;
}

/** True when the child has already exited. */
export function hasProcessExited(child) {
  return !child || child.exitCode !== null || child.signalCode !== null;
}

/**
 * Wait until *child* exits, or *timeoutMs* elapses.
 * @returns {Promise<boolean>} true if the process exited in time
 */
export function waitForProcessExit(child, timeoutMs) {
  return new Promise((resolve) => {
    if (hasProcessExited(child)) {
      resolve(true);
      return;
    }
    const timer = setTimeout(() => resolve(false), timeoutMs);
    child.once("exit", () => {
      clearTimeout(timer);
      resolve(true);
    });
  });
}

/**
 * Stop a spawned process and its children without propagating SIGINT.
 * On Windows uses taskkill /T /F so npm/electron do not print signal exit lines.
 */
export function killProcessTree(child) {
  const pid = child?.pid;
  if (!pid || hasProcessExited(child)) return;

  if (process.platform === "win32") {
    try {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    } catch {
      // Process already exited.
    }
    return;
  }

  try {
    child.kill("SIGTERM");
  } catch {
    // Process already exited.
  }
}

/**
 * Prefer a clean exit (uvicorn lifespan) before force-killing.
 *
 * On Ctrl+C the console signal often already reaches the Python child; force
 * ``taskkill /F`` mid-lifespan prints scary KeyboardInterrupt / CancelledError
 * stacks. Wait first, ask politely, then force only if still alive.
 */
export async function stopProcessTreeGracefully(child, { gracefulMs = 5_000 } = {}) {
  if (hasProcessExited(child)) return;

  const pid = child.pid;
  if (!pid) return;

  if (process.platform === "win32") {
    // Soft request (no /F). Console apps may ignore; the wait still helps when
    // the child is already draining from the shared Ctrl+C.
    try {
      execSync(`taskkill /PID ${pid} /T`, { stdio: "ignore" });
    } catch {
      // Already gone or soft-kill unsupported for this process type.
    }
  } else {
    try {
      child.kill("SIGTERM");
    } catch {
      // Process already exited.
    }
  }

  const exited = await waitForProcessExit(child, gracefulMs);
  if (!exited) {
    killProcessTree(child);
    await waitForProcessExit(child, 1_500);
  }
}

/** Image names we must not taskkill (Windows services / session 0). */
const WIN_SYSTEM_IMAGES = new Set([
  "svchost.exe",
  "system",
  "registry",
  "smss.exe",
  "csrss.exe",
  "wininit.exe",
  "services.exe",
  "lsass.exe",
  "winlogon.exe",
]);

const PORT_FREE_WAIT_MS = 4_000;

/** PIDs with a TCP LISTENING socket whose *local* port is exactly `port`. */
function listeningPidsOnPort(port) {
  let out = "";
  try {
    out = execSync("netstat -ano", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
  } catch {
    return [];
  }
  const pids = new Set();
  const want = String(port);
  for (const line of out.split(/\r?\n/)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5 || parts[0] !== "TCP" || parts[3] !== "LISTENING") continue;
    const local = parts[1];
    const colon = local.lastIndexOf(":");
    if (colon < 0 || local.slice(colon + 1) !== want) continue;
    const pid = parts[4];
    if (pid && pid !== "0") pids.add(pid);
  }
  return [...pids];
}

function windowsImageName(pid) {
  try {
    const csv = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const match = csv.match(/^"([^"]+)"/);
    return match ? match[1] : "";
  } catch {
    return "";
  }
}

function isWindowsSystemPid(pid, imageName = windowsImageName(pid)) {
  return WIN_SYSTEM_IMAGES.has(imageName.toLowerCase());
}

function userListeningPidsOnPort(port) {
  return listeningPidsOnPort(port).filter((pid) => !isWindowsSystemPid(pid));
}

/**
 * Kill user processes listening on `port` (Windows netstat/taskkill).
 *
 * A single try/catch around taskkill used to abort after the first failure.
 * IP Helper (svchost/iphlpsvc) often LISTENs on 127.0.0.1:port for a
 * netsh portproxy or IPv6 helper mapping — that PID is protected and must
 * not stop us from killing leftover node/vite on the same port.
 */
export async function freePort(port) {
  if (process.platform !== "win32") return;

  for (const pid of listeningPidsOnPort(port)) {
    const name = windowsImageName(pid);
    if (isWindowsSystemPid(pid, name)) {
      console.log(`[dev] Port ${port}: leaving system PID ${pid} (${name || "system"})`);
      continue;
    }
    console.log(`[dev] Freeing port ${port}: stopping PID ${pid}${name ? ` (${name})` : ""}`);
    try {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    } catch {
      console.warn(`[dev] Could not stop PID ${pid} on port ${port}`);
    }
  }

  const deadline = Date.now() + PORT_FREE_WAIT_MS;
  while (Date.now() < deadline) {
    if (userListeningPidsOnPort(port).length === 0) return;
    await delay(150);
  }
  const leftover = userListeningPidsOnPort(port);
  if (leftover.length > 0) {
    console.warn(
      `[dev] Port ${port} still LISTENING after free (PIDs: ${leftover.join(", ")}). ` +
        `Vite/server bind may fail.`,
    );
  }
}

/** Free dev ports before starting a new stack (avoids stale DB locks from orphan servers). */
export async function prepareDevPorts() {
  await freePort(SERVICE_PORT);
  await freePort(VITE_PORT);
}

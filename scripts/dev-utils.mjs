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

/** Kill any process listening on `port` (Windows netstat/taskkill). */
export function freePort(port) {
  if (process.platform !== "win32") return;

  try {
    const out = execSync(`netstat -ano | findstr :${port}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const pids = new Set();
    for (const line of out.split("\n")) {
      if (!line.includes("LISTENING")) continue;
      const pid = line.trim().split(/\s+/).at(-1);
      if (pid && pid !== "0") pids.add(pid);
    }
    for (const pid of pids) {
      console.log(`[dev] Freeing port ${port}: stopping PID ${pid}`);
      execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore" });
    }
  } catch {
    // Port already free or netstat found nothing.
  }
}

/** Free dev ports before starting a new stack (avoids stale DB locks from orphan servers). */
export function prepareDevPorts() {
  freePort(SERVICE_PORT);
  freePort(VITE_PORT);
}

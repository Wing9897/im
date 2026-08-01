import { spawn } from "node:child_process";
import { describe, expect, it } from "vitest";

// Root tsconfig typechecks tests only; .mjs helpers ship without adjacent types.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment -- ambient .mjs types not wired
// @ts-expect-error TS7016 — scripts/dev-utils.mjs has no committed declaration
import { hasProcessExited, waitForProcessExit } from "../../scripts/dev-utils.mjs";

/**
 * `waitForProcessExit` is the last thing standing between `npm run dev` exiting
 * and an orphaned Python server tree. It once threw ERR_INVALID_ARG_TYPE for any
 * child that outlived the grace window — the promise-based `setTimeout` was
 * imported over the global one — which crashed dev.mjs mid-cleanup and left the
 * server running. Anything that throws here strands processes on every shutdown.
 */
describe("dev shutdown helpers", () => {
  const spawnSleeper = () => spawn(process.execPath, ["-e", "setTimeout(() => {}, 60_000)"], { stdio: "ignore" });

  it("reports false instead of throwing when the child outlives the timeout", async () => {
    const child = spawnSleeper();
    try {
      await expect(waitForProcessExit(child, 150)).resolves.toBe(false);
    } finally {
      child.kill();
    }
  });

  it("resolves true once a live child exits", async () => {
    const child = spawnSleeper();
    const pending = waitForProcessExit(child, 10_000);
    child.kill();
    await expect(pending).resolves.toBe(true);
    expect(hasProcessExited(child)).toBe(true);
  });

  it("resolves true immediately for an already-exited child", async () => {
    const child = spawnSleeper();
    child.kill();
    await waitForProcessExit(child, 10_000);
    await expect(waitForProcessExit(child, 10_000)).resolves.toBe(true);
  });
});

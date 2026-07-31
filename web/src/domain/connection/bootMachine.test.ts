import { describe, expect, it } from "vitest";
import type { SetupStatus } from "../../api/setup";
import {
  bootReduce,
  initialBootState,
  shouldReenterAuthOnSessionChange,
  type BootMachineState,
} from "./bootMachine";

const setupStatus: SetupStatus = {
  bootstrapped: true,
  hasAdmin: true,
  hasActiveDevice: false,
  credentialsConfigured: true,
  localhostAuthExempt: false,
  resetPasswordForLocal: false,
};

function reduceMany(
  events: Parameters<typeof bootReduce>[1][],
  start: BootMachineState = initialBootState,
): BootMachineState {
  return events.reduce((state, event) => bootReduce(state, event), start);
}

describe("bootMachine", () => {
  it("starts in loading", () => {
    expect(initialBootState.phase).toBe("loading");
    expect(initialBootState.error).toBeNull();
    expect(initialBootState.secretsError).toBeNull();
    expect(initialBootState.setupStatus).toBeNull();
    expect(initialBootState.setupReason).toBeNull();
  });

  it("secrets blocked → secrets_blocked → rotate complete → auth ready", () => {
    const blocked = bootReduce(initialBootState, {
      type: "secrets_blocked",
      error: "Stored secret cannot be decrypted",
    });
    expect(blocked.phase).toBe("secrets_blocked");
    expect(blocked.secretsError).toBe("Stored secret cannot be decrypted");

    const state = reduceMany(
      [{ type: "secrets_gate_complete" }, { type: "schema_ok" }, { type: "auth_ready" }],
      blocked,
    );
    expect(state.phase).toBe("ready");
    expect(state.secretsError).toBeNull();
    expect(state.setupStatus).toBeNull();
  });

  it("secrets_gate_complete ignored unless phase is secrets_blocked", () => {
    const setup = bootReduce(initialBootState, {
      type: "auth_setup",
      status: setupStatus,
      reason: "needs_login",
    });
    expect(bootReduce(setup, { type: "secrets_gate_complete" })).toEqual(setup);
  });

  it("schema ok → setup when no session", () => {
    const state = reduceMany([
      { type: "check_started" },
      { type: "schema_ok" },
      { type: "auth_setup", status: setupStatus, reason: "first_run" },
    ]);
    expect(state.phase).toBe("setup");
    expect(state.setupStatus).toEqual(setupStatus);
    expect(state.setupReason).toBe("first_run");
  });

  it("stores session_expired reason for reauth UI", () => {
    const state = bootReduce(initialBootState, {
      type: "auth_setup",
      status: { ...setupStatus, hasActiveDevice: true },
      reason: "session_expired",
    });
    expect(state.setupReason).toBe("session_expired");
  });

  it("schema ok → ready when session present", () => {
    const state = reduceMany([
      { type: "check_started" },
      { type: "schema_ok" },
      { type: "auth_ready" },
    ]);
    expect(state.phase).toBe("ready");
  });

  it("hard failure → unavailable; retry restarts loading", () => {
    const failed = bootReduce(initialBootState, {
      type: "failed",
      error: "connection refused",
    });
    expect(failed.phase).toBe("unavailable");
    expect(failed.error).toBe("connection refused");

    const retried = bootReduce(failed, { type: "check_started" });
    expect(retried.phase).toBe("loading");
    expect(retried.error).toBeNull();
  });

  it("refresh failure (session_lost) leaves ready → loading then setup", () => {
    const ready = reduceMany([
      { type: "check_started" },
      { type: "schema_ok" },
      { type: "auth_ready" },
    ]);
    expect(shouldReenterAuthOnSessionChange(ready.phase, false)).toBe(true);

    const afterLost = bootReduce(ready, { type: "session_lost" });
    expect(afterLost.phase).toBe("loading");

    const setup = bootReduce(afterLost, {
      type: "auth_setup",
      status: setupStatus,
      reason: "needs_login",
    });
    expect(setup.phase).toBe("setup");
    expect(setup.setupReason).toBe("needs_login");
  });

  it("revoke-all: session_lost ignored unless phase is ready", () => {
    const setup = bootReduce(initialBootState, {
      type: "auth_setup",
      status: setupStatus,
      reason: "needs_login",
    });
    expect(bootReduce(setup, { type: "session_lost" })).toEqual(setup);
    expect(shouldReenterAuthOnSessionChange("setup", false)).toBe(false);
    expect(shouldReenterAuthOnSessionChange("ready", true)).toBe(false);
  });

  it("revoke-all while ready → loading → setup (re-bootstrap path)", () => {
    const ready: BootMachineState = {
      phase: "ready",
      error: null,
      secretsError: null,
      setupStatus: null,
      setupReason: null,
    };
    expect(shouldReenterAuthOnSessionChange(ready.phase, false)).toBe(true);

    const afterRevoke = bootReduce(ready, { type: "session_lost" });
    expect(afterRevoke.phase).toBe("loading");

    const next = bootReduce(afterRevoke, {
      type: "auth_setup",
      status: {
        ...setupStatus,
        // Align with server: revoke-all leaves bootstrapped true, no active device.
        hasActiveDevice: false,
        bootstrapped: true,
      },
      reason: "needs_login",
    });
    expect(next.phase).toBe("setup");
    expect(next.setupReason).toBe("needs_login");
    expect(next.setupStatus?.bootstrapped).toBe(true);
    expect(next.setupStatus?.hasActiveDevice).toBe(false);
  });

  it("setup_complete then auth_ready returns to shell", () => {
    const state = reduceMany([
      { type: "auth_setup", status: setupStatus, reason: "first_run" },
      { type: "setup_complete" },
      { type: "auth_ready" },
    ]);
    expect(state.phase).toBe("ready");
  });

  it("host reset path: check_started clears prior unavailable/setup payloads", () => {
    const dirty: BootMachineState = {
      phase: "unavailable",
      error: "stale remote baseUrl",
      secretsError: null,
      setupStatus,
      setupReason: "first_run",
    };
    const reset = bootReduce(dirty, { type: "check_started" });
    expect(reset).toEqual(initialBootState);

    const ready = reduceMany(
      [{ type: "schema_ok" }, { type: "auth_ready" }],
      reset,
    );
    expect(ready.phase).toBe("ready");
    expect(ready.error).toBeNull();
    expect(ready.setupStatus).toBeNull();
    expect(ready.setupReason).toBeNull();
  });
});

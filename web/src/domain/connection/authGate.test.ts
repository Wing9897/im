import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearDeviceSession,
  hasDeviceSession,
  saveDeviceSession,
} from "./connectionStore";
import { _resetConnectionStoreForTests } from "./connectionStore.testing";
const fetchSetupStatus = vi.fn();
const fetchSetupDevices = vi.fn();

vi.mock("../../api/setup", () => ({
  fetchSetupStatus: (...args: unknown[]) => fetchSetupStatus(...args),
  fetchSetupDevices: (...args: unknown[]) => fetchSetupDevices(...args),
}));

const { classifySetupReason, resolveAuthGate } = await import("./authGate");

const setupStatus = {
  bootstrapped: true,
  hasAdmin: true,
  hasActiveDevice: true,
  credentialsConfigured: true,
  localhostAuthExempt: false,
  resetPasswordForLocal: false,
};

describe("classifySetupReason", () => {
  it("returns needs_login when household is secured but no active device", () => {
    expect(
      classifySetupReason({
        ...setupStatus,
        hasActiveDevice: false,
      }),
    ).toBe("needs_login");
  });

  it("returns session_expired when session was cleared and household still has devices", () => {
    expect(classifySetupReason(setupStatus, { sessionCleared: true })).toBe(
      "session_expired",
    );
    expect(classifySetupReason(setupStatus, { fromSessionLoss: true })).toBe(
      "session_expired",
    );
  });

  it("returns first_run for fresh install", () => {
    expect(
      classifySetupReason({
        ...setupStatus,
        bootstrapped: false,
        hasActiveDevice: false,
      }),
    ).toBe("first_run");
  });
});

describe("resolveAuthGate", () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/");
    _resetConnectionStoreForTests();
    fetchSetupStatus.mockReset();
    fetchSetupDevices.mockReset().mockResolvedValue([
      {
        id: "d1",
        label: "Host",
        createdAt: "",
        lastSeenAt: "",
        expiresAt: "",
        current: true,
      },
    ]);
  });

  it("returns ready when a device session validates with the server", async () => {
    saveDeviceSession({
      accessToken: "access",
      refreshToken: "refresh",
      deviceId: "d1",
      deviceLabel: "Host",
    });
    fetchSetupStatus.mockResolvedValue(setupStatus);

    await expect(resolveAuthGate()).resolves.toEqual({ kind: "ready" });
    expect(fetchSetupDevices).toHaveBeenCalled();
  });

  it("returns session_expired setup when local session is rejected", async () => {
    saveDeviceSession({
      accessToken: "stale",
      refreshToken: "stale-r",
      deviceId: "d1",
    });
    fetchSetupStatus.mockResolvedValue(setupStatus);
    fetchSetupDevices.mockImplementation(async () => {
      clearDeviceSession();
      throw new Error("401");
    });

    await expect(resolveAuthGate()).resolves.toEqual({
      kind: "setup",
      status: setupStatus,
      reason: "session_expired",
    });
    expect(fetchSetupStatus).toHaveBeenCalledTimes(2);
  });

  it("returns first_run when there is no device session on a fresh host", async () => {
    const fresh = {
      ...setupStatus,
      bootstrapped: false,
      hasActiveDevice: false,
    };
    fetchSetupStatus.mockResolvedValue(fresh);

    await expect(resolveAuthGate()).resolves.toEqual({
      kind: "setup",
      status: fresh,
      reason: "first_run",
    });
    expect(fetchSetupDevices).not.toHaveBeenCalled();
  });

  it("Desktop host query shows first_run after DB wipe despite stale local tokens", async () => {
    window.history.replaceState({}, "", "/?desktop=1");
    saveDeviceSession({
      accessToken: "pre-wipe-access",
      refreshToken: "pre-wipe-refresh",
      deviceId: "old-device",
    });
    const fresh = {
      ...setupStatus,
      bootstrapped: false,
      hasAdmin: false,
      hasActiveDevice: false,
      credentialsConfigured: false,
      localhostAuthExempt: true,
    };
    fetchSetupStatus.mockResolvedValue(fresh);

    await expect(resolveAuthGate()).resolves.toEqual({
      kind: "setup",
      status: fresh,
      reason: "first_run",
    });
    expect(hasDeviceSession()).toBe(false);
    expect(fetchSetupDevices).not.toHaveBeenCalled();
  });

  it("Desktop host query shows login for an existing admin without a session", async () => {
    window.history.replaceState({}, "", "/?desktop=1");
    fetchSetupStatus.mockResolvedValue(setupStatus);

    await expect(resolveAuthGate()).resolves.toEqual({
      kind: "setup",
      status: setupStatus,
      reason: "first_run",
    });
    expect(fetchSetupDevices).not.toHaveBeenCalled();
  });

  it("rejects a stored token when the auth probe has no current device", async () => {
    saveDeviceSession({
      accessToken: "stale",
      refreshToken: "stale-r",
      deviceId: "old-device",
    });
    fetchSetupStatus.mockResolvedValue(setupStatus);
    fetchSetupDevices.mockResolvedValue([]);

    await expect(resolveAuthGate()).resolves.toEqual({
      kind: "setup",
      status: setupStatus,
      reason: "session_expired",
    });
    expect(hasDeviceSession()).toBe(false);
  });

  it("returns needs_login when bootstrapped but no active device", async () => {
    const status = { ...setupStatus, hasActiveDevice: false };
    fetchSetupStatus.mockResolvedValue(status);

    await expect(resolveAuthGate()).resolves.toEqual({
      kind: "setup",
      status,
      reason: "needs_login",
    });
  });

  it("marks session_expired when fromSessionLoss and household still has devices", async () => {
    fetchSetupStatus.mockResolvedValue(setupStatus);

    await expect(resolveAuthGate({ fromSessionLoss: true })).resolves.toEqual({
      kind: "setup",
      status: setupStatus,
      reason: "session_expired",
    });
  });
});

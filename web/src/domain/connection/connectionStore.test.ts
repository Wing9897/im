import { beforeEach, describe, expect, it } from "vitest";
import {
  _resetConnectionStoreForTests,
  clearConnection,
  getAccessToken,
  getConnectionSnapshot,
  hasDeviceSession,
  saveDeviceSession,
  setConnectionMode,
  setServerBaseUrl,
} from "./connectionStore";

describe("connectionStore", () => {
  beforeEach(() => {
    localStorage.clear();
    _resetConnectionStoreForTests();
  });

  it("persists connection mode and server base URL", () => {
    setConnectionMode("remote");
    setServerBaseUrl("http://192.168.1.5:18820///");
    const snap = getConnectionSnapshot();
    expect(snap.connectionMode).toBe("remote");
    expect(snap.serverBaseUrl).toBe("http://192.168.1.5:18820");
  });

  it("saveDeviceSession stores access + refresh", () => {
    saveDeviceSession({
      accessToken: "access-1",
      refreshToken: "refresh-1",
      deviceId: "dev-1",
      deviceLabel: "Phone",
    });
    expect(hasDeviceSession()).toBe(true);
    expect(getAccessToken()).toBe("access-1");
    expect(getConnectionSnapshot().deviceLabel).toBe("Phone");
  });

  it("clearConnection wipes tokens and preferences", () => {
    setConnectionMode("local");
    saveDeviceSession({ accessToken: "a", refreshToken: "r" });
    clearConnection();
    expect(hasDeviceSession()).toBe(false);
    expect(getConnectionSnapshot().connectionMode).toBeNull();
  });
});

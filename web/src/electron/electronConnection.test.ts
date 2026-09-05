import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAccessToken,
  getConnectionSnapshot,
  saveDeviceSession,
  setConnectionMode,
  setServerBaseUrl,
} from "../domain/connection/connectionStore";
import { _resetConnectionStoreForTests } from "../domain/connection/connectionStore.testing";
import {
  applyLocalWebConnectionDefaults,
  applyRemoteWebConnection,
  desktopModeToWeb,
  ensureDesktopClientMode,
  ensureDesktopHostMode,
  getElectronConnection,
  relaunchAfterDestructiveReset,
  resetDesktopConnectionAfterLogout,
  subscribeDesktopAnalysisTrayCommand,
  subscribeDesktopNotificationLocale,
  syncDesktopConnectionOnBoot,
  webModeToDesktop,
} from "./electronConnection";
import { getAppLocalePreference, setAppLocalePreference } from "../i18n/locale";

describe("electronConnection bridge", () => {
  beforeEach(() => {
    delete window.electronConnection;
    localStorage.clear();
    _resetConnectionStoreForTests();
  });

  afterEach(() => {
    delete window.electronConnection;
  });

  it("maps Desktop host|client ↔ Web local|remote in one place", () => {
    expect(desktopModeToWeb("host")).toBe("local");
    expect(desktopModeToWeb("client")).toBe("remote");
    expect(webModeToDesktop("local")).toBe("host");
    expect(webModeToDesktop("remote")).toBe("client");
  });

  it("getElectronConnection is undefined in pure browser", () => {
    expect(getElectronConnection()).toBeUndefined();
  });

  it("ensureDesktopHostMode / clientMode no-op without preload", async () => {
    expect(await ensureDesktopHostMode()).toBe(false);
    expect(await ensureDesktopClientMode("http://192.168.1.10:18820")).toBe(
      false,
    );
    await expect(resetDesktopConnectionAfterLogout()).resolves.toBeUndefined();
  });

  it("syncDesktopConnectionOnBoot applies local defaults only for Desktop host", async () => {
    setConnectionMode("remote");
    setServerBaseUrl("http://192.168.1.10:18820");
    window.electronConnection = {
      getConnection: vi.fn().mockResolvedValue({ mode: "host" }),
      setConnection: vi.fn(),
      restartShell: vi.fn(),
    };
    await syncDesktopConnectionOnBoot();
    expect(getConnectionSnapshot().connectionMode).toBe("local");
    expect(getConnectionSnapshot().serverBaseUrl).toBeNull();
  });

  it("syncDesktopConnectionOnBoot leaves store alone for Desktop client", async () => {
    setConnectionMode("remote");
    setServerBaseUrl("http://192.168.1.10:18820");
    window.electronConnection = {
      getConnection: vi
        .fn()
        .mockResolvedValue({
          mode: "client",
          serverUrl: "http://192.168.1.10:18820",
        }),
      setConnection: vi.fn(),
      restartShell: vi.fn(),
    };
    await syncDesktopConnectionOnBoot();
    expect(getConnectionSnapshot().connectionMode).toBe("remote");
    expect(getConnectionSnapshot().serverBaseUrl).toBe(
      "http://192.168.1.10:18820",
    );
  });

  it("syncDesktopConnectionOnBoot retries then surfaces IPC failures", async () => {
    setConnectionMode("remote");
    setServerBaseUrl("http://192.168.1.10:18820");
    const getConnection = vi
      .fn()
      .mockRejectedValue(new Error("IPC unavailable"));
    window.electronConnection = {
      getConnection,
      setConnection: vi.fn(),
      restartShell: vi.fn(),
    };
    await expect(syncDesktopConnectionOnBoot()).rejects.toThrow(
      "IPC unavailable",
    );
    expect(getConnection.mock.calls.length).toBeGreaterThanOrEqual(2);
    // Must not silently leave a poisoned remote baseUrl as if sync succeeded.
    expect(getConnectionSnapshot().connectionMode).toBe("remote");
    expect(getConnectionSnapshot().serverBaseUrl).toBe(
      "http://192.168.1.10:18820",
    );
  });

  it("syncDesktopConnectionOnBoot recovers after a transient IPC failure", async () => {
    setConnectionMode("remote");
    setServerBaseUrl("http://192.168.1.10:18820");
    const getConnection = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValue({ mode: "host" });
    window.electronConnection = {
      getConnection,
      setConnection: vi.fn(),
      restartShell: vi.fn(),
    };
    await syncDesktopConnectionOnBoot();
    expect(getConnection).toHaveBeenCalledTimes(2);
    expect(getConnectionSnapshot().connectionMode).toBe("local");
    expect(getConnectionSnapshot().serverBaseUrl).toBeNull();
  });

  it("applyLocal / applyRemote Web helpers are the store write entry", () => {
    applyRemoteWebConnection("http://192.168.1.10:18820/");
    expect(getConnectionSnapshot().connectionMode).toBe("remote");
    expect(getConnectionSnapshot().serverBaseUrl).toBe(
      "http://192.168.1.10:18820",
    );
    applyLocalWebConnectionDefaults();
    expect(getConnectionSnapshot().connectionMode).toBe("local");
    expect(getConnectionSnapshot().serverBaseUrl).toBeNull();
  });

  it("ensureDesktopHostMode sets host without restart when already host", async () => {
    const setConnection = vi.fn().mockResolvedValue({ mode: "host" });
    const restartShell = vi.fn();
    window.electronConnection = {
      getConnection: vi.fn().mockResolvedValue({ mode: "host" }),
      setConnection,
      restartShell,
    };
    expect(await ensureDesktopHostMode()).toBe(false);
    expect(setConnection).toHaveBeenCalledWith({ mode: "host" });
    expect(restartShell).not.toHaveBeenCalled();
  });

  it("ensureDesktopHostMode restarts when switching from client", async () => {
    const setConnection = vi.fn().mockResolvedValue({ mode: "host" });
    const restartShell = vi.fn().mockResolvedValue({ ok: true });
    window.electronConnection = {
      getConnection: vi
        .fn()
        .mockResolvedValue({
          mode: "client",
          serverUrl: "http://192.168.1.10:18820",
        }),
      setConnection,
      restartShell,
    };
    expect(await ensureDesktopHostMode()).toBe(true);
    expect(setConnection).toHaveBeenCalledWith({ mode: "host" });
    expect(restartShell).toHaveBeenCalled();
  });

  it("ensureDesktopClientMode restarts when mode or URL differs", async () => {
    const setConnection = vi.fn().mockResolvedValue({
      mode: "client",
      serverUrl: "http://192.168.1.10:18820",
    });
    const restartShell = vi.fn().mockResolvedValue({ ok: true });
    window.electronConnection = {
      getConnection: vi.fn().mockResolvedValue({ mode: "host" }),
      setConnection,
      restartShell,
    };
    expect(await ensureDesktopClientMode("http://192.168.1.10:18820/")).toBe(
      true,
    );
    expect(setConnection).toHaveBeenCalledWith({
      mode: "client",
      serverUrl: "http://192.168.1.10:18820",
    });
    expect(restartShell).toHaveBeenCalled();
  });

  it("ensureDesktopClientMode skips restart when already on same client URL", async () => {
    const setConnection = vi.fn();
    const restartShell = vi.fn();
    window.electronConnection = {
      getConnection: vi.fn().mockResolvedValue({
        mode: "client",
        serverUrl: "http://192.168.1.10:18820",
      }),
      setConnection,
      restartShell,
    };
    expect(await ensureDesktopClientMode("http://192.168.1.10:18820/")).toBe(
      false,
    );
    expect(setConnection).not.toHaveBeenCalled();
    expect(restartShell).not.toHaveBeenCalled();
  });

  it("resetDesktopConnectionAfterLogout resets client to host", async () => {
    const setConnection = vi.fn().mockResolvedValue({ mode: "host" });
    const restartShell = vi.fn().mockResolvedValue({ ok: true });
    window.electronConnection = {
      getConnection: vi
        .fn()
        .mockResolvedValue({
          mode: "client",
          serverUrl: "http://192.168.1.10:18820",
        }),
      setConnection,
      restartShell,
    };
    await resetDesktopConnectionAfterLogout();
    expect(setConnection).toHaveBeenCalledWith({ mode: "host" });
    expect(restartShell).toHaveBeenCalled();
  });

  it("relaunchAfterDestructiveReset clears session and restarts Desktop host shell", async () => {
    saveDeviceSession({
      accessToken: "tok",
      refreshToken: "ref",
      deviceId: "dev-1",
      deviceLabel: "Host",
    });
    const setConnection = vi.fn();
    const restartShell = vi.fn().mockResolvedValue({ ok: true });
    window.electronConnection = {
      getConnection: vi.fn().mockResolvedValue({ mode: "host" }),
      setConnection,
      restartShell,
    };

    await relaunchAfterDestructiveReset();

    expect(getAccessToken()).toBeUndefined();
    expect(setConnection).not.toHaveBeenCalled();
    expect(restartShell).toHaveBeenCalled();
  });

  it("relaunchAfterDestructiveReset switches client to host before relaunch", async () => {
    const setConnection = vi.fn().mockResolvedValue({ mode: "host" });
    const restartShell = vi.fn().mockResolvedValue({ ok: true });
    window.electronConnection = {
      getConnection: vi
        .fn()
        .mockResolvedValue({
          mode: "client",
          serverUrl: "http://192.168.1.10:18820",
        }),
      setConnection,
      restartShell,
    };

    await relaunchAfterDestructiveReset();

    expect(setConnection).toHaveBeenCalledWith({ mode: "host" });
    expect(restartShell).toHaveBeenCalled();
  });

  it("relaunchAfterDestructiveReset reloads browser when Desktop IPC is absent", async () => {
    const reload = vi.fn();
    vi.stubGlobal("location", { ...window.location, reload });

    await relaunchAfterDestructiveReset();

    expect(reload).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("ensureDesktopClientMode surfaces IPC errors", async () => {
    window.electronConnection = {
      getConnection: vi.fn().mockResolvedValue({ mode: "host" }),
      setConnection: vi.fn().mockRejectedValue(new Error("disk full")),
      restartShell: vi.fn(),
    };
    await expect(
      ensureDesktopClientMode("http://192.168.1.10:18820"),
    ).rejects.toThrow("disk full");
  });

  it("subscribeDesktopNotificationLocale applies tray preference and pushes current preference", async () => {
    const setNotificationLocale = vi.fn();
    const setUiLocalePreference = vi.fn();
    const getPendingUiLocalePreference = vi.fn().mockResolvedValue("en");
    let applyLocale: ((preference: string) => void) | undefined;
    window.electronConnection = {
      getConnection: vi.fn(),
      setConnection: vi.fn(),
      restartShell: vi.fn(),
      setNotificationLocale,
      setUiLocalePreference,
      getPendingUiLocalePreference,
      onApplyUiLocalePreference: (callback) => {
        applyLocale = callback;
        return () => {
          applyLocale = undefined;
        };
      },
    };

    const unsub = subscribeDesktopNotificationLocale();
    await getPendingUiLocalePreference.mock.results[0]?.value;

    expect(setUiLocalePreference).toHaveBeenCalled();
    expect(getAppLocalePreference()).toBe("en");

    applyLocale?.("zh-Hans");
    expect(getAppLocalePreference()).toBe("zh-Hans");

    unsub();
    setAppLocalePreference("zh-Hant");
  });

  it("subscribeDesktopAnalysisTrayCommand forwards pause / resume / abort", () => {
    let emit: ((command: string) => void) | undefined;
    window.electronConnection = {
      getConnection: vi.fn(),
      setConnection: vi.fn(),
      restartShell: vi.fn(),
      onAnalysisTrayCommand: (callback) => {
        emit = callback;
        return () => {
          emit = undefined;
        };
      },
    };
    const onCommand = vi.fn();
    const unsub = subscribeDesktopAnalysisTrayCommand(onCommand);
    emit?.("pause");
    emit?.("nope");
    emit?.("abort");
    expect(onCommand.mock.calls).toEqual([["pause"], ["abort"]]);
    unsub();
  });
});

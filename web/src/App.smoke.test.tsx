import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetConnectionStoreForTests,
  clearConnection,
  hasDeviceSession,
  saveDeviceSession,
} from "./domain/connection/connectionStore";
import { wrapWithI18n } from "./test/i18nHarness";

const fetchHealth = vi.fn();
const resolveAuthGate = vi.fn();
const syncDesktopConnectionOnBoot = vi.fn();
const isElectronDesktop = vi.fn(() => false);

vi.mock("./api/system", async () => {
  const actual = await vi.importActual<typeof import("./api/system")>("./api/system");
  return {
    ...actual,
    fetchHealth: (...args: unknown[]) => fetchHealth(...args),
  };
});

vi.mock("./domain/connection/authGate", () => ({
  resolveAuthGate: (...args: unknown[]) => resolveAuthGate(...args),
}));

vi.mock("./electron/electronConnection", async () => {
  const actual = await vi.importActual<typeof import("./electron/electronConnection")>(
    "./electron/electronConnection",
  );
  return {
    ...actual,
    syncDesktopConnectionOnBoot: (...args: unknown[]) =>
      syncDesktopConnectionOnBoot(...args),
  };
});

vi.mock("./electron/electronWindow", () => ({
  isElectronDesktop: () => isElectronDesktop(),
}));

vi.mock("./board/BoardRoot", () => ({
  BoardRoot: () => createElement("div", { "data-testid": "board-stub" }),
}));

vi.mock("./components/AppSidebar", () => ({
  AppSidebar: () => null,
  MAIN_SIDEBAR_PREFETCH_PATHS: [] as string[],
}));

vi.mock("./components/AppTopBar", () => ({
  AppTopBar: () => createElement("div", { "data-testid": "topbar-stub" }),
}));

vi.mock("./components/DesktopTitleBar", () => ({
  DesktopTitleBar: () => null,
}));

vi.mock("./components/CommandPalette", () => ({
  CommandPalette: () => null,
}));

vi.mock("./components/ShortcutHelpDialog", () => ({
  ShortcutHelpDialog: () => null,
}));

vi.mock("./components/AssistantQuickDialog", () => ({
  AssistantQuickDialog: () => null,
}));

vi.mock("./routing/AppRoutes", () => ({
  AppRoutes: () => createElement("div", { "data-testid": "routes-stub" }),
}));

vi.mock("./domain/notify/scanner/useNotifyScanner", () => ({
  useNotifyScanner: () => {},
}));

vi.mock("./hooks/useCommandPalette", () => ({
  CommandPaletteProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("./hooks/useAssistantQuick", () => ({
  AssistantQuickProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("./hooks/useAssistantChat", () => ({
  AssistantChatProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("./context/AppRuntimeContext", () => ({
  AppRuntimeProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("./context/TaskCatalogContext", () => ({
  TaskCatalogProvider: ({ children }: { children: ReactNode }) => children,
}));

const { App } = await import("./App");

describe("App smoke", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    window.history.replaceState({}, "", "/");
    _resetConnectionStoreForTests();
    fetchHealth.mockReset();
    resolveAuthGate.mockReset();
    syncDesktopConnectionOnBoot.mockReset().mockResolvedValue(undefined);
    isElectronDesktop.mockReset().mockReturnValue(false);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
  });

  it("mounts AppShell when schema and auth are ready (useState fence)", async () => {
    saveDeviceSession({
      accessToken: "access",
      refreshToken: "refresh",
      deviceId: "d1",
      deviceLabel: "Host",
    });
    fetchHealth.mockResolvedValue({
      status: "ok",
      version: "1.0.0",
      runtimeReady: true,
      secretsReady: true,
    });
    resolveAuthGate.mockResolvedValue({ kind: "ready" });

    await act(async () => {
      root.render(
        wrapWithI18n(createElement(App)),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="app-shell-pages"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="routes-stub"]')).toBeTruthy();
  });

  it("awaits Desktop connection sync before schema check", async () => {
    window.history.replaceState({}, "", "/?desktop=1");
    isElectronDesktop.mockReturnValue(true);
    let releaseSync!: () => void;
    const syncGate = new Promise<void>((resolve) => {
      releaseSync = resolve;
    });
    const order: string[] = [];
    syncDesktopConnectionOnBoot.mockImplementation(async () => {
      order.push("sync");
      await syncGate;
    });
    fetchHealth.mockImplementation(async () => {
      order.push("health");
      return {
        status: "ok",
        version: "1.0.0",
        runtimeReady: true,
        secretsReady: true,
      };
    });
    resolveAuthGate.mockResolvedValue({
      kind: "setup",
      status: {
        bootstrapped: false,
        hasAdmin: false,
        hasActiveDevice: false,
        credentialsConfigured: false,
        localhostAuthExempt: true,
        resetPasswordForLocal: false,
      },
      reason: "first_run",
    });

    await act(async () => {
      root.render(
        wrapWithI18n(createElement(App)),
      );
      await Promise.resolve();
    });

    expect(order).toEqual(["sync"]);
    expect(fetchHealth).not.toHaveBeenCalled();

    await act(async () => {
      releaseSync();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(order).toEqual(["sync", "health"]);
    expect(container.querySelector('[data-testid="first-run-wizard"]')).toBeTruthy();
  });

  it("Desktop host query with existing admin and no session opens login", async () => {
    window.history.replaceState({}, "", "/?desktop=1");
    isElectronDesktop.mockReturnValue(true);
    fetchHealth.mockResolvedValue({
      status: "ok",
      version: "1.0.0",
      runtimeReady: true,
      secretsReady: true,
    });
    resolveAuthGate.mockResolvedValue({
      kind: "setup",
      status: {
        bootstrapped: true,
        hasAdmin: true,
        hasActiveDevice: true,
        credentialsConfigured: true,
        localhostAuthExempt: false,
        resetPasswordForLocal: false,
      },
      reason: "first_run",
    });

    await act(async () => {
      root.render(
        wrapWithI18n(createElement(App)),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(syncDesktopConnectionOnBoot).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="session-reauth-wizard"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="first-run-wizard"]')).toBeNull();
    expect(container.querySelector('[data-testid="app-shell-pages"]')).toBeNull();
  });

  it("session_lost with expire reason opens SessionReauthWizard (not 3-step)", async () => {
    saveDeviceSession({
      accessToken: "access",
      refreshToken: "refresh",
      deviceId: "d1",
      deviceLabel: "Host",
    });
    fetchHealth.mockResolvedValue({
      status: "ok",
      version: "1.0.0",
      runtimeReady: true,
      secretsReady: true,
    });
    resolveAuthGate
      .mockResolvedValueOnce({ kind: "ready" })
      .mockResolvedValueOnce({
        kind: "setup",
        status: {
          bootstrapped: true,
          hasAdmin: true,
          hasActiveDevice: true,
          credentialsConfigured: true,
          localhostAuthExempt: false,
          resetPasswordForLocal: false,
        },
        reason: "session_expired",
      });

    await act(async () => {
      root.render(
        wrapWithI18n(createElement(App)),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="app-shell-pages"]')).toBeTruthy();

    await act(async () => {
      clearConnection();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(resolveAuthGate).toHaveBeenCalledTimes(2);
    expect(resolveAuthGate).toHaveBeenLastCalledWith({ fromSessionLoss: true });
    expect(container.querySelector('[data-testid="session-reauth-wizard"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="first-run-wizard"]')).toBeNull();
    expect(container.querySelector('[data-testid="setup-step-indicator"]')).toBeNull();
    expect(container.querySelector('[data-testid="app-shell-pages"]')).toBeNull();
  });

  it("session_lost needs_login opens unified login card (not create-system)", async () => {
    saveDeviceSession({
      accessToken: "access",
      refreshToken: "refresh",
      deviceId: "d1",
      deviceLabel: "Host",
    });
    fetchHealth.mockResolvedValue({
      status: "ok",
      version: "1.0.0",
      runtimeReady: true,
      secretsReady: true,
    });
    resolveAuthGate
      .mockResolvedValueOnce({ kind: "ready" })
      .mockResolvedValueOnce({
        kind: "setup",
        status: {
          bootstrapped: true,
          hasAdmin: true,
          hasActiveDevice: false,
          credentialsConfigured: true,
          localhostAuthExempt: false,
          resetPasswordForLocal: false,
        },
        reason: "needs_login",
      });

    await act(async () => {
      root.render(
        wrapWithI18n(createElement(App)),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    await act(async () => {
      clearConnection();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="session-reauth-wizard"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="first-run-wizard"]')).toBeNull();
    expect(container.querySelector('[data-testid="setup-step-indicator"]')).toBeNull();
    expect(container.querySelector('[data-testid="setup-mode-local"]')).toBeNull();
  });

  it("secretsReady false clears session and shows SecretsBrokenGate", async () => {
    saveDeviceSession({
      accessToken: "access",
      refreshToken: "refresh",
      deviceId: "d1",
      deviceLabel: "Host",
    });
    fetchHealth.mockResolvedValue({
      status: "ok",
      version: "1.0.0",
      runtimeReady: true,
      secretsReady: false,
      secretsError: "Stored secret cannot be decrypted",
    });

    await act(async () => {
      root.render(
        wrapWithI18n(createElement(App)),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(resolveAuthGate).not.toHaveBeenCalled();
    expect(hasDeviceSession()).toBe(false);
    expect(container.textContent).toMatch(/加密|Encryption|金鑰|密钥/i);
    expect(container.querySelector('[data-testid="secrets-broken-gate"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="secrets-rotate-username"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="secrets-rotate-password"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="secrets-rotate-submit"]')).toBeTruthy();
    expect(container.textContent).not.toMatch(/完全重置本机数据库|Fully reset local database|完全重設本機資料庫/);
    expect(container.querySelector('[data-testid="app-shell-pages"]')).toBeNull();
  });

  it("surfaces Desktop connection sync failure as unavailable", async () => {
    isElectronDesktop.mockReturnValue(true);
    syncDesktopConnectionOnBoot.mockRejectedValue(new Error("IPC unavailable"));

    await act(async () => {
      root.render(
        wrapWithI18n(createElement(App)),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchHealth).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/IPC unavailable/);
    expect(container.querySelector('[data-testid="app-shell-pages"]')).toBeNull();
  });
});

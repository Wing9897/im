import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { I18nextProvider } from "react-i18next";
import i18n from "./i18n";
import {
  _resetConnectionStoreForTests,
  clearConnection,
  saveDeviceSession,
} from "./domain/connection/connectionStore";

const fetchSchemaStatus = vi.fn();
const resolveAuthGate = vi.fn();
const syncDesktopConnectionOnBoot = vi.fn();
const isElectronDesktop = vi.fn(() => false);

vi.mock("./api/schema", () => ({
  fetchSchemaStatus: (...args: unknown[]) => fetchSchemaStatus(...args),
}));

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

vi.mock("./voiceReminder/useVoiceReminderScanner", () => ({
  useVoiceReminderScanner: () => {},
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
    fetchSchemaStatus.mockReset();
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
    fetchSchemaStatus.mockResolvedValue({
      runtimeReady: true,
      userVersion: 10,
      expectedVersion: 10,
      needsUpgrade: false,
      hardReject: false,
    });
    resolveAuthGate.mockResolvedValue({ kind: "ready" });

    await act(async () => {
      root.render(
        createElement(I18nextProvider, { i18n }, createElement(App)),
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
    fetchSchemaStatus.mockImplementation(async () => {
      order.push("schema");
      return {
        runtimeReady: true,
        userVersion: 10,
        expectedVersion: 10,
        needsUpgrade: false,
        hardReject: false,
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
        createElement(I18nextProvider, { i18n }, createElement(App)),
      );
      await Promise.resolve();
    });

    expect(order).toEqual(["sync"]);
    expect(fetchSchemaStatus).not.toHaveBeenCalled();

    await act(async () => {
      releaseSync();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(order).toEqual(["sync", "schema"]);
    expect(container.querySelector('[data-testid="first-run-wizard"]')).toBeTruthy();
  });

  it("Desktop host query with existing admin and no session opens login", async () => {
    window.history.replaceState({}, "", "/?desktop=1");
    isElectronDesktop.mockReturnValue(true);
    fetchSchemaStatus.mockResolvedValue({
      runtimeReady: true,
      userVersion: 23,
      expectedVersion: 23,
      needsUpgrade: false,
      hardReject: false,
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
        createElement(I18nextProvider, { i18n }, createElement(App)),
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
    fetchSchemaStatus.mockResolvedValue({
      runtimeReady: true,
      userVersion: 10,
      expectedVersion: 10,
      needsUpgrade: false,
      hardReject: false,
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
        createElement(I18nextProvider, { i18n }, createElement(App)),
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
    fetchSchemaStatus.mockResolvedValue({
      runtimeReady: true,
      userVersion: 10,
      expectedVersion: 10,
      needsUpgrade: false,
      hardReject: false,
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
        createElement(I18nextProvider, { i18n }, createElement(App)),
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

  it("surfaces Desktop connection sync failure as unavailable", async () => {
    isElectronDesktop.mockReturnValue(true);
    syncDesktopConnectionOnBoot.mockRejectedValue(new Error("IPC unavailable"));

    await act(async () => {
      root.render(
        createElement(I18nextProvider, { i18n }, createElement(App)),
      );
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(fetchSchemaStatus).not.toHaveBeenCalled();
    expect(container.textContent).toMatch(/IPC unavailable/);
    expect(container.querySelector('[data-testid="app-shell-pages"]')).toBeNull();
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { MonitorModeProvider } from "../context/MonitorModeContext";
import { DesktopTitleBar } from "./DesktopTitleBar";

vi.mock("../context/CollectorStatusContext", () => ({
  useCollectorStatus: () => ({
    collectorStatus: "running" as const,
    aiEngineStatus: "available" as const,
    requestAiStatusRefresh: () => {},
  }),
}));

vi.mock("../context/AnalysisStatusContext", () => ({
  useAnalysisStatus: () => ({
    analysisPaused: false,
  }),
}));

vi.mock("../context/ToastContext", async () =>
  (await import("../test/context-mocks")).toastContextModuleMock());

vi.mock("../hooks/useCommandPalette", () => ({
  useCommandPalette: () => ({
    open: false,
    query: "",
    setQuery: vi.fn(),
    filtered: [],
    openPalette: vi.fn(),
    closePalette: vi.fn(),
    runItem: vi.fn(),
  }),
}));

vi.mock("../hooks/useAssistantQuick", () => ({
  useAssistantQuick: () => ({
    captionActive: true,
    composerOpen: false,
    editableFocused: false,
    voiceLive: true,
    captionListening: false,
    openCaption: vi.fn(),
    closeCaption: vi.fn(),
    openComposer: vi.fn(),
    closeComposer: vi.fn(),
    toggleComposer: vi.fn(),
    setCaptionListening: vi.fn(),
    chatActions: null,
    registerChatActions: vi.fn(),
  }),
}));

function renderTitleBar() {
  return createElement(
    MemoryRouter,
    null,
    createElement(MonitorModeProvider, null, createElement(DesktopTitleBar)),
  );
}

describe("DesktopTitleBar", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    delete window.electronWindow;
    sessionStorage.clear();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    document.body.removeChild(container);
    delete window.electronWindow;
    sessionStorage.clear();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("renders nothing outside the desktop shell", () => {
    act(() => {
      createRoot(container).render(renderTitleBar());
    });
    expect(container.querySelector(".desktop-title-bar")).toBeNull();
  });

  it("renders window controls when only the desktop query flag is present", async () => {
    window.history.replaceState({}, "", "/?desktop=1");

    await act(async () => {
      createRoot(container).render(renderTitleBar());
      await Promise.resolve();
    });

    expect(container.querySelector(".desktop-title-bar")).not.toBeNull();
    expect(container.querySelector('[aria-label="最小化"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="最大化"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="關閉"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="sidebar-collapse"]')).toBeNull();
    expect(container.querySelector(".desktop-title-bar-collapse")).toBeNull();
    expect(container.querySelector('[data-testid="monitor-mode-switch"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="assistant-chrome-composer"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="assistant-quick-trigger"]')).toBeNull();
  });

  it("renders window controls when electron API is available", async () => {
    const minimize = vi.fn();
    const toggleMaximize = vi.fn();
    const close = vi.fn();
    window.electronWindow = {
      isDesktopShell: true,
      getState: vi.fn().mockResolvedValue({ isMaximized: false }),
      minimize,
      toggleMaximize,
      close,
      onMaximizedChange: () => () => {},
    };

    await act(async () => {
      createRoot(container).render(renderTitleBar());
      await Promise.resolve();
    });

    expect(container.querySelector(".desktop-title-bar")).not.toBeNull();
    expect(container.textContent).toContain("Intelligence Monitor");
    expect(container.querySelector('[data-testid="sidebar-collapse"]')).toBeNull();
    expect(container.querySelector(".desktop-title-bar-collapse")).toBeNull();

    const minimizeBtn = container.querySelector('[aria-label="最小化"]') as HTMLButtonElement;
    const maximizeBtn = container.querySelector('[aria-label="最大化"]') as HTMLButtonElement;
    const closeBtn = container.querySelector('[aria-label="關閉"]') as HTMLButtonElement;

    act(() => {
      minimizeBtn.click();
      maximizeBtn.click();
      closeBtn.click();
    });

    expect(minimize).toHaveBeenCalledTimes(1);
    expect(toggleMaximize).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("shows merged system status and open-viewer action in the title bar", async () => {
    window.history.replaceState({}, "", "/?desktop=1");

    await act(async () => {
      createRoot(container).render(renderTitleBar());
      await Promise.resolve();
    });

    expect(container.textContent).toContain("系統正常");
    expect(container.querySelector("[data-testid='system-status-pill']")).not.toBeNull();
    expect(container.querySelector("[data-testid='open-viewer-btn']")).not.toBeNull();
    expect(container.querySelector("[data-testid='chrome-channel-voice']")).toBeNull();
    expect(container.querySelector("[data-testid='chrome-channel-flash']")).toBeNull();
    const actions = container.querySelector("[data-testid='shell-chrome-actions']");
    const statusArea = container.querySelector("[data-testid='topbar-status-area']");
    const iconArea = container.querySelector("[data-testid='topbar-icon-actions']");
    const search = container.querySelector("[data-testid='command-palette-trigger']");
    const chrome = container.querySelector("[data-testid='assistant-chrome']");
    const controls = container.querySelector("[data-testid='desktop-window-controls']");
    expect(actions?.lastElementChild).toBe(statusArea);
    expect(search && chrome
      ? search.compareDocumentPosition(chrome) & Node.DOCUMENT_POSITION_FOLLOWING
      : 0).toBeTruthy();
    expect(chrome && iconArea
      ? chrome.compareDocumentPosition(iconArea) & Node.DOCUMENT_POSITION_FOLLOWING
      : 0).toBeTruthy();
    expect(iconArea && statusArea
      ? iconArea.compareDocumentPosition(statusArea) & Node.DOCUMENT_POSITION_FOLLOWING
      : 0).toBeTruthy();
    expect(actions?.nextElementSibling).toBe(controls);
  });

  it("does not render a title-bar sidebar collapse control", async () => {
    window.history.replaceState({}, "", "/?desktop=1");
    window.localStorage.setItem("im:monitor-mode", "canvas");

    await act(async () => {
      createRoot(container).render(renderTitleBar());
      await Promise.resolve();
    });

    expect(container.querySelector('[data-testid="sidebar-collapse"]')).toBeNull();
    expect(container.querySelector(".desktop-title-bar-collapse")).toBeNull();
    expect(container.querySelector('[data-testid="monitor-mode-switch"]')).not.toBeNull();
  });
});

import { describe, it, expect, vi } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { MonitorModeProvider } from "../context/MonitorModeContext";

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
    activeAnalysis: null,
    queueStatus: { analysisPaused: false, pendingCount: 0, processingBatches: [] },
    activeAnalyses: new Map(),
    requestQueueStatusRefresh: () => {},
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

const { ShellChromeCore } = await import("./ShellChromeCore");

describe("ShellChromeCore", () => {
  it("web layout includes brand, collapse, mode, right icon actions, and status", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(
          MemoryRouter,
          null,
          createElement(
            MonitorModeProvider,
            null,
            createElement(ShellChromeCore, { layout: "web", showCollapse: true }),
          ),
        ),
      );
    });
    expect(container.querySelector('[data-testid="shell-chrome-brand"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="sidebar-collapse"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="monitor-mode-switch"]')).not.toBeNull();
    const actions = container.querySelector('[data-testid="shell-chrome-actions"]');
    expect(actions).not.toBeNull();
    expect(actions?.querySelector('[data-testid="assistant-chrome-composer"]')).not.toBeNull();
    expect(actions?.querySelector('[data-testid="assistant-chrome"]')).not.toBeNull();
    expect(actions?.querySelector('[data-testid="assistant-quick-trigger"]')).toBeNull();
    expect(actions?.querySelector(".im-command-trigger--compact")).not.toBeNull();
    expect(container.querySelector('[data-testid="system-status-pill"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="desktop-window-controls"]')).toBeNull();
    // Icon-only: no visible shortcut kbd in the trigger cluster.
    expect(actions?.querySelector(".im-command-kbd")).toBeNull();
  });

  it("desktop layout clusters actions and can hide collapse", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(
          MemoryRouter,
          null,
          createElement(
            MonitorModeProvider,
            null,
            createElement(ShellChromeCore, {
              layout: "desktop",
              showCollapse: false,
              actionsClassName: "desktop-title-bar-actions",
            }),
          ),
        ),
      );
    });
    expect(container.querySelector('[data-testid="shell-chrome-actions"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="sidebar-collapse"]')).toBeNull();
    expect(container.querySelector('[data-testid="assistant-chrome-composer"]')).not.toBeNull();
  });

  it("places assistant chrome left of the search trigger", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(
          MemoryRouter,
          null,
          createElement(
            MonitorModeProvider,
            null,
            createElement(ShellChromeCore, { layout: "web", showCollapse: true }),
          ),
        ),
      );
    });
    const actions = container.querySelector('[data-testid="shell-chrome-actions"]')!;
    const chrome = actions.querySelector('[data-testid="assistant-chrome"]');
    expect(chrome).not.toBeNull();
    expect(actions.firstElementChild).toBe(chrome);
    expect(actions.children[1]?.querySelector("svg")).not.toBeNull();
  });
});

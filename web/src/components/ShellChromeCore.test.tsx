import { describe, it, expect, vi } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { MonitorModeProvider } from "../context/MonitorModeContext";
import { PRODUCT_MARK_SRC } from "./ProductMark";

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
  it("web layout includes brand, mode, right icon actions, and status", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(
          MemoryRouter,
          null,
          createElement(
            MonitorModeProvider,
            null,
            createElement(ShellChromeCore, { layout: "web" }),
          ),
        ),
      );
    });
    const brand = container.querySelector('[data-testid="shell-chrome-brand"]');
    expect(brand).not.toBeNull();
    expect(brand?.querySelector('[data-testid="product-mark"]')?.getAttribute("src")).toBe(
      PRODUCT_MARK_SRC,
    );
    expect(container.querySelector('[data-testid="sidebar-collapse"]')).toBeNull();
    expect(container.querySelector('[data-testid="monitor-mode-switch"]')).not.toBeNull();
    const actions = container.querySelector('[data-testid="shell-chrome-actions"]');
    expect(actions).not.toBeNull();
    expect(actions?.querySelector('[data-testid="assistant-chrome-composer"]')).not.toBeNull();
    expect(actions?.querySelector('[data-testid="assistant-chrome"]')).not.toBeNull();
    expect(actions?.querySelector('[data-testid="assistant-quick-trigger"]')).toBeNull();
    expect(actions?.querySelector(".im-command-trigger--compact")).not.toBeNull();
    expect(container.querySelector('[data-testid="system-status-pill"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="desktop-window-controls"]')).toBeNull();
    expect(actions?.lastElementChild?.getAttribute("data-testid")).toBe("topbar-status-area");
    expect(container.querySelector("[data-testid='chrome-channel-voice']")).toBeNull();
    // Icon-only: no visible shortcut kbd in the trigger cluster.
    expect(actions?.querySelector(".im-command-kbd")).toBeNull();
  });

  it("desktop layout clusters actions without a title-bar collapse control", () => {
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

  it("places search and assistant left of notify, with collector last before window chrome", () => {
    const container = document.createElement("div");
    act(() => {
      createRoot(container).render(
        createElement(
          MemoryRouter,
          null,
          createElement(
            MonitorModeProvider,
            null,
            createElement(ShellChromeCore, { layout: "web" }),
          ),
        ),
      );
    });
    const actions = container.querySelector('[data-testid="shell-chrome-actions"]')!;
    const spacer = actions.querySelector(".shell-chrome-spacer");
    const search = actions.querySelector('[data-testid="command-palette-trigger"]');
    const chrome = actions.querySelector('[data-testid="assistant-chrome"]');
    const status = actions.querySelector('[data-testid="topbar-status-area"]');
    const icons = actions.querySelector('[data-testid="topbar-icon-actions"]');
    expect(chrome).not.toBeNull();
    expect(search).not.toBeNull();
    expect(actions.firstElementChild).toBe(spacer);
    expect(actions.lastElementChild).toBe(status);
    expect(
      spacer!.compareDocumentPosition(search!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      search!.compareDocumentPosition(chrome!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      chrome!.compareDocumentPosition(icons!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      icons!.compareDocumentPosition(status!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

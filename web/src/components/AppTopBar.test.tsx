import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { MonitorModeProvider } from "../context/MonitorModeContext";
import { mockShowToast } from "../test/context-mocks";

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

vi.mock("../api/system", () => ({
  setAnalysisPaused: vi.fn(async () => {}),
  emergencyAbortAnalysis: vi.fn(async () => {}),
}));

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

// Import after mocks are set up
const { AppTopBar } = await import("./AppTopBar");

describe("AppTopBar", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    mockShowToast.mockReset();
    window.localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
    sessionStorage.clear();
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  function renderBar() {
    act(() => {
      createRoot(container).render(
        createElement(
          MemoryRouter,
          null,
          createElement(MonitorModeProvider, null, createElement(AppTopBar)),
        ),
      );
    });
  }

  it("renders the app title without a title-bar sidebar collapse control", () => {
    renderBar();
    expect(container.textContent).toContain("Intelligence Monitor");
    expect(container.querySelector("[data-testid='sidebar-collapse']")).toBeNull();
    expect(container.querySelector(".desktop-title-bar-collapse")).toBeNull();
    expect(container.querySelector("[data-testid='monitor-mode-switch']")).not.toBeNull();
    expect(container.querySelector("[data-testid='assistant-chrome-composer']")).not.toBeNull();
    expect(container.querySelector("[data-testid='assistant-quick-trigger']")).toBeNull();
  });

  it("renders nothing in desktop shell mode", () => {
    window.history.replaceState({}, "", "/?desktop=1");
    renderBar();
    expect(container.textContent).toBe("");
  });

  it("does not render navigation links (navigation lives in the sidebar)", () => {
    renderBar();
    expect(container.querySelectorAll("a").length).toBe(0);
  });

  it("renders merged system status pill", () => {
    renderBar();
    expect(container.textContent).toContain("系統正常");
    const pill = container.querySelector("[data-testid='system-status-pill']");
    expect(pill).not.toBeNull();
    expect(pill?.tagName).toBe("BUTTON");
    const titled = container.querySelector("[data-testid='analysis-status-control'] [title]");
    expect(titled?.getAttribute("title")).toContain("收集器運行中");
    expect(titled?.getAttribute("title")).toContain("AI 引擎正常");
  });

  it("keeps the status pill outside the icon action area and rightmost in chrome", () => {
    renderBar();
    const actions = container.querySelector("[data-testid='shell-chrome-actions']") as HTMLDivElement;
    const iconArea = container.querySelector("[data-testid='topbar-icon-actions']") as HTMLDivElement;
    const statusArea = container.querySelector("[data-testid='topbar-status-area']") as HTMLDivElement;
    const inbox = container.querySelector("[data-testid='recent-day-inbox-btn']") as HTMLButtonElement;
    const viewer = container.querySelector("[data-testid='open-viewer-btn']") as HTMLButtonElement;
    expect(iconArea).not.toBeNull();
    expect(iconArea.textContent).not.toContain("系統正常");
    expect(container.querySelector("[data-testid='chrome-channel-voice']")).toBeNull();
    expect(container.querySelector("[data-testid='chrome-channel-flash']")).toBeNull();
    expect(actions.lastElementChild).toBe(statusArea);
    expect(inbox.compareDocumentPosition(viewer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(viewer.compareDocumentPosition(statusArea) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps search and assistant as right-aligned icon-only controls", () => {
    renderBar();
    const actions = container.querySelector(
      "[data-testid='shell-chrome-actions']",
    ) as HTMLDivElement;
    expect(actions).not.toBeNull();
    expect(actions.className).toContain("ml-auto");
    expect(actions.querySelectorAll(".im-command-trigger--compact").length).toBeGreaterThanOrEqual(
      2,
    );
    expect(actions.querySelector(".im-command-kbd")).toBeNull();
  });

  it("renders the open-viewer action and opens a viewer window on click", () => {
    const openSpy = vi.spyOn(window, "open").mockReturnValue(null);
    renderBar();

    const viewerBtn = container.querySelector("[data-testid='open-viewer-btn']") as HTMLButtonElement;
    expect(viewerBtn).not.toBeNull();
    expect(viewerBtn.getAttribute("aria-label")).toBe("開啟新 viewer");

    act(() => {
      viewerBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(openSpy).toHaveBeenCalledWith(
      window.location.origin + "/viewer",
      "_blank",
      "noopener,noreferrer",
    );
    openSpy.mockRestore();
  });

  it("shows a toast when opening the viewer window fails", () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => {
      throw new Error("blocked");
    });
    renderBar();

    const viewerBtn = container.querySelector("[data-testid='open-viewer-btn']") as HTMLButtonElement;
    act(() => {
      viewerBtn.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(mockShowToast).toHaveBeenCalledWith("blocked", "error");
    openSpy.mockRestore();
  });
});

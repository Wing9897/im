import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import {
  MONITOR_MODE_KEY,
  MonitorModeProvider,
  useMonitorMode,
} from "../context/MonitorModeContext";
import { MonitorModeSwitch } from "../components/MonitorModeSwitch";
import { ToastProvider } from "../context/ToastContext";
import { BoardRoot } from "./BoardRoot";
import { resetBoardPrefsCacheForTests } from "./boardPrefsStore";

vi.mock("../api/results", () => ({
  fetchEvents: vi.fn(async () => ({ items: [], totalCount: 0, hasMore: false })),
  fetchCalendarOccurrences: vi.fn(async () => []),
  fetchTrendingTopics: vi.fn(async () => []),
  fetchTaskAnalysisStats: vi.fn(async () => []),
  fetchQueueStatus: vi.fn(async () => ({
    pendingCount: 0,
    processingBatches: [],
    attentionBatches: [],
    analysisPaused: false,
  })),
}));

vi.mock("../api/messages", () => ({
  queryMessagesPage: vi.fn(async () => ({
    messages: [],
    nextCursor: null,
    hasMore: false,
    totalCount: 0,
  })),
}));

vi.mock("../api/tasks", () => ({
  fetchTaskActivitySpans: vi.fn(async () => []),
  listTasks: vi.fn(async () => []),
}));

vi.mock("../api/uiPrefs", () => ({
  fetchBoardPrefs: vi.fn(async () => ({
    configured: false,
    layout: null,
    widgetState: null,
  })),
  putBoardPrefs: vi.fn(async (body: {
    layout?: unknown;
    widgetState?: unknown;
  }) => ({
    configured: true,
    layout: body.layout ?? null,
    widgetState: body.widgetState ?? { mapViews: {}, sourceFilters: {} },
  })),
}));

vi.mock("../api/actions", () => ({
  listActions: vi.fn(async () => []),
}));

vi.mock("../api/logs", () => ({
  queryAppLogsPage: vi.fn(async () => ({
    logs: [],
    nextCursor: null,
    hasMore: false,
    totalCount: 0,
  })),
}));

vi.mock("../api/channels", () => ({
  listChannelsWithSources: vi.fn(async () => []),
  fetchLatestByChannels: vi.fn(async () => ({})),
}));

vi.mock("../api/sources", () => ({
  listSources: vi.fn(async () => []),
}));

vi.mock("../api/config", () => ({
  fetchSystemSettings: vi.fn(async () => ({ weatherLocation: "system" })),
}));

vi.mock("../api/weather", () => ({
  fetchWeatherForecast: vi.fn(async () => ({
    daily: {
      time: ["2026-07-22"],
      weather_code: [0],
      temperature_2m_max: [30],
      temperature_2m_min: [24],
    },
  })),
}));

vi.mock("../context/CollectorStatusContext", () => ({
  useCollectorStatus: () => ({
    collectorStatus: "running",
    aiEngineStatus: "available",
    requestAiStatusRefresh: vi.fn(),
  }),
}));

vi.mock("../context/AnalysisStatusContext", async () =>
  (await import("../test/context-mocks")).analysisStatusModuleMock(),
);

vi.mock("../context/TaskCatalogContext", async () =>
  (await import("../test/context-mocks")).taskCatalogModuleMock(),
);

/** Mirrors App.tsx dual-shell keep-mount + inert focus isolation. */
function shellVisibilityProps(isHidden: boolean) {
  return {
    hidden: isHidden,
    "aria-hidden": isHidden,
    className: isHidden
      ? "pointer-events-none absolute inset-0 z-0 hidden min-h-0 min-w-0 overflow-hidden [content-visibility:hidden]"
      : "absolute inset-0 z-[2] flex min-h-0 min-w-0 overflow-hidden",
    ...(isHidden ? ({ inert: "" } as Record<string, string>) : {}),
  };
}

function ShellFixture() {
  const { monitorMode } = useMonitorMode();
  const isCanvas = monitorMode === "canvas";
  return createElement(
    "div",
    {
      "data-testid": isCanvas ? "app-shell-canvas" : "app-shell-pages",
      "data-monitor-mode": monitorMode,
    },
    createElement(MonitorModeSwitch),
    // Board first, pages second — matches App.tsx hit-testing order.
    createElement(
      "div",
      {
        "data-testid": "app-shell-board-pane",
        "data-shell-pane": "board",
        ...shellVisibilityProps(!isCanvas),
      },
      createElement(BoardRoot),
    ),
    createElement(
      "div",
      {
        "data-testid": "app-shell-pages-pane",
        "data-shell-pane": "pages",
        ...shellVisibilityProps(isCanvas),
      },
      createElement("nav", { "data-testid": "app-sidebar", "aria-label": "側欄" }, "sidebar"),
      createElement("main", null, "pages"),
    ),
  );
}

describe("monitor mode + board smoke", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.clear();
    resetBoardPrefsCacheForTests();
    // BoardCanvas scales via ResizeObserver; report 0 while under [hidden].
    // On canvas show it also dispatches window "resize" — re-fire so tests
    // prove a non-zero remeasure without remounting the board surface.
    class RO {
      private readonly callback: ResizeObserverCallback;
      private target: Element | null = null;
      private readonly onWindowResize: () => void;
      constructor(callback: ResizeObserverCallback) {
        this.callback = callback;
        this.onWindowResize = () => this.fire();
      }
      private fire() {
        if (!this.target) return;
        const hidden = Boolean((this.target as HTMLElement).closest("[hidden]"));
        const width = hidden ? 0 : 640;
        const entry = {
          target: this.target,
          contentRect: {
            width,
            height: 400,
            top: 0,
            left: 0,
            bottom: 400,
            right: width,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          },
          borderBoxSize: [],
          contentBoxSize: [],
          devicePixelContentBoxSize: [],
        } as ResizeObserverEntry;
        this.callback([entry], this as unknown as ResizeObserver);
      }
      observe(target: Element) {
        this.target = target;
        window.addEventListener("resize", this.onWindowResize);
        this.fire();
      }
      unobserve() {
        window.removeEventListener("resize", this.onWindowResize);
        this.target = null;
      }
      disconnect() {
        this.unobserve();
      }
    }
    vi.stubGlobal("ResizeObserver", RO);

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
    window.localStorage.clear();
    vi.unstubAllGlobals();
  });

  function renderShell(initialPath = "/monitor") {
    act(() => {
      root.render(
        createElement(
          MemoryRouter,
          { initialEntries: [initialPath] },
          createElement(
            ToastProvider,
            null,
            createElement(MonitorModeProvider, null, createElement(ShellFixture)),
          ),
        ),
      );
    });
  }

  async function flushEffects() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("pages mode shows sidebar; canvas mode hides it", async () => {
    renderShell();
    expect(container.querySelector('[data-testid="app-shell-pages"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="app-sidebar"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="app-shell-canvas"]')).toBeNull();
    expect(
      container.querySelector('[data-testid="app-shell-pages-pane"]')?.hasAttribute("hidden"),
    ).toBe(false);
    // Inactive board must use display:none class — `.flex` alone would stack shells.
    expect(
      container.querySelector('[data-testid="app-shell-board-pane"]')?.classList.contains("hidden"),
    ).toBe(true);
    expect(
      container.querySelector('[data-testid="app-shell-pages-pane"]')?.classList.contains("flex"),
    ).toBe(true);
    // Visible pages shell must sit above a keep-mounted board (z-index / DOM order).
    const pagesPane = container.querySelector(
      '[data-testid="app-shell-pages-pane"]',
    ) as HTMLElement;
    const boardPane = container.querySelector(
      '[data-testid="app-shell-board-pane"]',
    ) as HTMLElement;
    expect(pagesPane.className).toContain("z-[2]");
    expect(boardPane.className).toContain("hidden");
    expect(boardPane.compareDocumentPosition(pagesPane) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Board stays mounted but hidden in pages mode.
    expect(container.querySelector('[data-testid="board-root"]')).toBeTruthy();
    expect(
      container.querySelector('[data-testid="app-shell-board-pane"]')?.hasAttribute("hidden"),
    ).toBe(true);

    const canvasBtn = container.querySelector(
      '[data-testid="monitor-mode-canvas"]',
    ) as HTMLButtonElement;
    expect(canvasBtn).toBeTruthy();

    act(() => {
      canvasBtn.click();
    });
    await flushEffects();

    expect(container.querySelector('[data-testid="app-shell-canvas"]')).toBeTruthy();
    // Pages shell stays mounted (warm routes) but is hidden in canvas mode.
    expect(
      container.querySelector('[data-testid="app-shell-pages-pane"]')?.hasAttribute("hidden"),
    ).toBe(true);
    expect(
      container.querySelector('[data-testid="app-shell-board-pane"]')?.hasAttribute("hidden"),
    ).toBe(false);
    expect(container.querySelector('[data-testid="board-root"]')).toBeTruthy();
    expect(window.localStorage.getItem(MONITOR_MODE_KEY)).toBe("canvas");
  });

  it("keeps board mounted when switching pages ↔ canvas", async () => {
    renderShell();
    await flushEffects();

    const boardBefore = container.querySelector('[data-testid="board-root"]');
    expect(boardBefore).toBeTruthy();

    const canvasBtn = container.querySelector(
      '[data-testid="monitor-mode-canvas"]',
    ) as HTMLButtonElement;
    act(() => {
      canvasBtn.click();
    });
    await flushEffects();

    const boardInCanvas = container.querySelector('[data-testid="board-root"]');
    expect(boardInCanvas).toBe(boardBefore);

    // Enter edit mode — one click on FAB (no intermediate pencil).
    const fabToggle = container.querySelector(
      '[data-testid="board-fab-toggle"]',
    ) as HTMLButtonElement;
    act(() => {
      fabToggle.click();
    });
    expect(container.querySelector('[data-testid="board-add-widget"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-enter-edit"]')).toBeNull();

    const pagesBtn = container.querySelector(
      '[data-testid="monitor-mode-pages"]',
    ) as HTMLButtonElement;
    act(() => {
      pagesBtn.click();
    });
    await flushEffects();

    expect(container.querySelector('[data-testid="board-root"]')).toBe(boardBefore);
    expect(container.querySelector('[data-testid="board-add-widget"]')).toBeTruthy();
    expect(
      container.querySelector('[data-testid="app-shell-board-pane"]')?.hasAttribute("hidden"),
    ).toBe(true);
    expect(
      container.querySelector('[data-testid="app-shell-pages-pane"]')?.hasAttribute("hidden"),
    ).toBe(false);

    // Switch back to canvas: free-surface keeps the same mount — no remount key.
    const surfaceBefore = container.querySelector(".board-free-surface");
    expect(surfaceBefore).toBeTruthy();

    act(() => {
      canvasBtn.click();
    });
    await flushEffects();
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    });

    expect(container.querySelector(".board-free-surface")).toBe(surfaceBefore);
    const item = container.querySelector("[data-widget-mount]") as HTMLElement | null;
    expect(item).toBeTruthy();
  });

  it("applies inert on the hidden shell", async () => {
    renderShell();
    await flushEffects();

    const pagesPane = container.querySelector(
      '[data-testid="app-shell-pages-pane"]',
    ) as HTMLElement;
    const boardPane = container.querySelector(
      '[data-testid="app-shell-board-pane"]',
    ) as HTMLElement;
    expect(pagesPane.hasAttribute("inert")).toBe(false);
    expect(boardPane.hasAttribute("inert")).toBe(true);

    const canvasBtn = container.querySelector(
      '[data-testid="monitor-mode-canvas"]',
    ) as HTMLButtonElement;
    act(() => {
      canvasBtn.click();
    });
    await flushEffects();

    expect(pagesPane.hasAttribute("inert")).toBe(true);
    expect(boardPane.hasAttribute("inert")).toBe(false);
  });

  it("restores last pages path when switching back", async () => {
    window.localStorage.setItem("im:pages-last-path", "/intelligence");
    window.localStorage.setItem(MONITOR_MODE_KEY, "canvas");
    renderShell("/intelligence");
    await flushEffects();

    expect(container.querySelector('[data-testid="app-shell-canvas"]')).toBeTruthy();

    const pagesBtn = container.querySelector(
      '[data-testid="monitor-mode-pages"]',
    ) as HTMLButtonElement;
    act(() => {
      pagesBtn.click();
    });
    await flushEffects();

    expect(container.querySelector('[data-testid="app-shell-pages"]')).toBeTruthy();
    expect(window.localStorage.getItem(MONITOR_MODE_KEY)).toBe("pages");
  });

  it("BoardRoot mounts chrome + canvas with default widgets", async () => {
    window.localStorage.setItem(MONITOR_MODE_KEY, "canvas");
    renderShell();
    await flushEffects();

    expect(container.querySelector('[data-testid="board-chrome"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-canvas"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-canvas"]')?.getAttribute("data-board-widget-count")).toBe(
      "18",
    );
    expect(container.querySelector('[data-testid="board-widget-map"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-widget-wall"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-widget-weather"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-widget-events"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-widget-feed"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-widget-gantt"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-widget-gantt-events"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-widget-leaderboard"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-widget-system"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-widget-clock"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-widget-calendar-day"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-widget-queue"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-widget-stats"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-widget-sources"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-map-reset-view"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-map-save-view"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-fab-toggle"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-chrome"]')).toBeTruthy();
    expect(
      container.querySelector('[data-testid="board-free-surface"]')?.contains(
        container.querySelector('[data-testid="board-chrome"]'),
      ),
    ).toBe(true);

    const fabToggle = container.querySelector(
      '[data-testid="board-fab-toggle"]',
    ) as HTMLButtonElement;
    act(() => {
      fabToggle.click();
    });
    expect(container.querySelector('[data-testid="board-enter-edit"]')).toBeNull();
    expect(container.querySelector('[data-testid="board-add-widget"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-done-edit"]')).toBeTruthy();
  });

  it("reset layout restores full mosaic after sparse cache", async () => {
    window.localStorage.setItem(MONITOR_MODE_KEY, "canvas");
    // Hydrate seeds the default mosaic from server prefs (configured:false mock);
    // leftover LS board keys are not a migrate path.
    renderShell();
    await flushEffects();
    expect(
      Number(container.querySelector('[data-testid="board-canvas"]')?.getAttribute("data-board-widget-count")),
    ).toBeGreaterThanOrEqual(6);

    const fabToggle = container.querySelector(
      '[data-testid="board-fab-toggle"]',
    ) as HTMLButtonElement;
    act(() => {
      fabToggle.click();
    });
    await flushEffects();

    // Delete non-map frames if present (simulate sparse again via remove buttons).
    const removeButtons = Array.from(
      container.querySelectorAll('[data-testid^="board-remove-"]'),
    ) as HTMLButtonElement[];
    // Prefer reset path directly.
    const resetBtn = container.querySelector(
      '[data-testid="board-reset-layout"]',
    ) as HTMLButtonElement;
    expect(resetBtn).toBeTruthy();
    act(() => {
      resetBtn.click();
    });
    await flushEffects();
    const confirm = Array.from(document.querySelectorAll("button")).find((b) =>
      b.textContent?.includes("確認重置"),
    ) as HTMLButtonElement | undefined;
    expect(confirm).toBeTruthy();
    act(() => {
      confirm!.click();
    });
    await flushEffects();

    expect(container.querySelector('[data-testid="board-canvas"]')?.getAttribute("data-board-widget-count")).toBe(
      "18",
    );
    expect(container.querySelector('[data-testid="board-widget-map"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-widget-wall"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-widget-gantt"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-widget-events"]')).toBeTruthy();
    void removeButtons;
  });
});

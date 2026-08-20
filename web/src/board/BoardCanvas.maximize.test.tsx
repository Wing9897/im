import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, useState, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MONITOR_MODE_KEY } from "../context/MonitorModeContext";
import { BoardCanvas, nudgeBoardRemeasure } from "./BoardCanvas";
import { wrapBoardProviders } from "./boardTestHarness";
import type { BoardConfig } from "./types";

vi.mock("../api/results", () => ({
  fetchEvents: vi.fn(async () => ({ items: [], totalCount: 0, hasMore: false })),
  fetchQueueStatus: vi.fn(async () => ({
    pendingCount: 0,
    processingBatches: [],
    attentionBatches: [],
    analysisPaused: false,
  })),
}));

vi.mock("../api/calendarWindow", () => ({
  fetchCalendarWindow: vi.fn(async () => []),
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
}));

vi.mock("../context/AnalysisStatusContext", async () =>
  (await import("../test/context-mocks")).analysisStatusModuleMock(),
);

vi.mock("../context/TaskCatalogContext", async () =>
  (await import("../test/context-mocks")).taskCatalogModuleMock(),
);

const sampleConfig: BoardConfig = {
  version: 5,
  widgets: [
    { i: "w-events", type: "events", col: 0, row: 0, sizeId: "3x3" },
    { i: "w-feed", type: "feed", col: 3, row: 0, sizeId: "3x3" },
    { i: "w-queue", type: "queue", col: 6, row: 0, sizeId: "2x2" },
  ],
};

function Harness({ initialMax = null as string | null }) {
  const [maxId, setMaxId] = useState<string | null>(initialMax);
  return createElement(BoardCanvas, {
    config: sampleConfig,
    editMode: "view",
    maximizedId: maxId,
    onConfigChange: () => {},
    onMaximize: setMaxId,
  });
}

describe("BoardCanvas maximize keeps siblings mounted", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    window.localStorage.setItem(MONITOR_MODE_KEY, "canvas");
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => 1200,
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get: () => 800,
    });
    class RO {
      observe() {}
      unobserve() {}
      disconnect() {}
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
    vi.restoreAllMocks();
  });

  async function flush() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  it("keeps all widget mounts in the DOM when one is maximized", async () => {
    act(() => {
      root.render(wrapBoardProviders(createElement(Harness)));
    });
    await flush();

    const eventsBefore = container.querySelector('[data-testid="board-widget-events"]');
    const feedBefore = container.querySelector('[data-testid="board-widget-feed"]');
    const queueBefore = container.querySelector('[data-testid="board-widget-queue"]');
    expect(eventsBefore).toBeTruthy();
    expect(feedBefore).toBeTruthy();
    expect(queueBefore).toBeTruthy();

    const maxBtn = eventsBefore!.querySelector(
      'button[aria-label="最大化組件"]',
    ) as HTMLButtonElement;
    act(() => {
      maxBtn.click();
    });
    await flush();

    expect(container.querySelector(".board-canvas--maximized")).toBeTruthy();
    expect(container.querySelector('[data-widget-mount="w-events"]')).toBeTruthy();
    expect(container.querySelector('[data-widget-mount="w-feed"]')).toBeTruthy();
    expect(container.querySelector('[data-widget-mount="w-queue"]')).toBeTruthy();
    // Same DOM nodes still present (not remounted via conditional branch).
    expect(container.querySelector('[data-testid="board-widget-events"]')).toBe(eventsBefore);
    expect(container.querySelector('[data-testid="board-widget-feed"]')).toBe(feedBefore);
    expect(container.querySelector('[data-testid="board-widget-queue"]')).toBe(queueBefore);
    expect(container.querySelector(".board-free-item--maximized")).toBeTruthy();
    expect(container.querySelectorAll(".board-free-item--obscured").length).toBe(2);
  });

  it("nudges board remeasure when maximize toggles", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    act(() => {
      root.render(wrapBoardProviders(createElement(Harness)));
    });
    await flush();
    dispatchSpy.mockClear();

    const maxBtn = container.querySelector(
      'button[aria-label="最大化組件"]',
    ) as HTMLButtonElement;
    act(() => {
      maxBtn.click();
    });
    await flush();
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    const resizeCalls = dispatchSpy.mock.calls.filter(
      ([event]) => event instanceof Event && event.type === "resize",
    );
    expect(resizeCalls.length).toBeGreaterThanOrEqual(1);

    dispatchSpy.mockClear();
    const restoreBtn = container.querySelector(
      'button[aria-label="還原組件"]',
    ) as HTMLButtonElement;
    act(() => {
      restoreBtn.click();
    });
    await flush();
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    const restoreResizes = dispatchSpy.mock.calls.filter(
      ([event]) => event instanceof Event && event.type === "resize",
    );
    expect(restoreResizes.length).toBeGreaterThanOrEqual(1);

    vi.useRealTimers();
  });

  it("nudgeBoardRemeasure dispatches window resize", () => {
    const spy = vi.spyOn(window, "dispatchEvent");
    nudgeBoardRemeasure();
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ type: "resize" }));
    spy.mockRestore();
  });

  it("shows empty board hint when there are no widgets", async () => {
    act(() => {
      root.render(
        wrapBoardProviders(
          createElement(BoardCanvas, {
            config: { ...sampleConfig, widgets: [] },
            editMode: "edit",
            maximizedId: null,
            onConfigChange: () => {},
            onMaximize: () => {},
          }),
        ),
      );
    });
    await flush();
    expect(container.querySelector('[data-testid="board-empty"]')).toBeTruthy();
    expect(container.textContent).toContain("新增組件");
  });

  it("exposes size presets in edit mode (not free resize handles)", async () => {
    act(() => {
      root.render(
        wrapBoardProviders(
          createElement(BoardCanvas, {
            config: sampleConfig,
            editMode: "edit",
            maximizedId: null,
            onConfigChange: () => {},
            onMaximize: () => {},
          }),
        ),
      );
    });
    await flush();
    expect(container.querySelector(".board-canvas--edit")).toBeTruthy();
    expect(container.querySelector('[data-testid="board-size-w-events"]')).toBeTruthy();
    expect(container.querySelector(".react-resizable-handle")).toBeNull();
  });
});

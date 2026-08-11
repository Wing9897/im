import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MONITOR_MODE_KEY } from "../context/MonitorModeContext";
import { BoardCanvas } from "./BoardCanvas";
import { wrapBoardProviders } from "./boardTestHarness";
import type { BoardConfig } from "./types";

const mapEmbedMount = vi.fn();
const ganttEmbedMount = vi.fn();
const wallEmbedMount = vi.fn();

vi.mock("./embeds/MapBoardEmbed", () => ({
  BOARD_MAP_DEFAULT_CENTER: [20, 0],
  BOARD_MAP_DEFAULT_ZOOM: 1,
  MapBoardEmbed: function MockMapEmbed() {
    mapEmbedMount();
    return createElement("div", { "data-testid": "board-map-embed" }, "map");
  },
  default: function MockMapEmbedDefault() {
    mapEmbedMount();
    return createElement("div", { "data-testid": "board-map-embed" }, "map");
  },
}));

vi.mock("./embeds/GanttBoardEmbed", () => ({
  GanttBoardEmbed: function MockGanttEmbed() {
    ganttEmbedMount();
    return createElement("div", { "data-testid": "board-gantt-embed" }, "gantt");
  },
  default: function MockGanttEmbedDefault() {
    ganttEmbedMount();
    return createElement("div", { "data-testid": "board-gantt-embed" }, "gantt");
  },
}));

vi.mock("./embeds/WallBoardEmbed", () => ({
  WallBoardEmbed: function MockWallEmbed() {
    wallEmbedMount();
    return createElement("div", { "data-testid": "board-wall-embed" }, "wall");
  },
  default: function MockWallEmbedDefault() {
    wallEmbedMount();
    return createElement("div", { "data-testid": "board-wall-embed" }, "wall");
  },
}));

vi.mock("./embeds/CalendarBoardEmbed", () => ({
  CalendarBoardEmbed: function MockCalEmbed() {
    return createElement("div", { "data-testid": "board-calendar-embed" }, "cal");
  },
  default: function MockCalEmbedDefault() {
    return createElement("div", { "data-testid": "board-calendar-embed" }, "cal");
  },
}));

vi.mock("../api/results", () => ({
  fetchEvents: vi.fn(async () => ({
    items: [
      {
        id: "e1",
        taskId: "t1",
        version: 1,
        batchId: "b1",
        title: "geo",
        body: "",
        startTime: null,
        endTime: null,
        location: null,
        latitude: 25,
        longitude: 121,
        participants: [],
        sourceMessageId: null,
        sourcePlatform: null,
        sourceChannelName: null,
        sourceMessageTime: null,
        analysisTimeRange: null,
        batchSourceChannelNames: [],
        taskName: "T",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    totalCount: 1,
    hasMore: false,
  })),
  fetchCalendarOccurrences: vi.fn(async () => [
    {
      id: "c1",
      taskId: "t1",
      title: "會議",
      taskName: "T",
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      isAllDay: false,
      location: null,
      description: null,
      rrule: "FREQ=DAILY",
    },
  ]),
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
  fetchTaskActivitySpans: vi.fn(async () => [
    {
      seriesId: "task-1",
      taskName: "任務",
      description: null,
      analysisTimeRange: "1d",
      isActive: true,
      earliestBatchStart: "2026-01-01T00:00:00.000Z",
      latestBatchEnd: "2026-01-02T00:00:00.000Z",
      completedBatchCount: 1,
    },
  ]),
}));

vi.mock("../context/AnalysisStatusContext", async () =>
  (await import("../test/context-mocks")).analysisStatusModuleMock(),
);

vi.mock("../context/TaskCatalogContext", async () =>
  (await import("../test/context-mocks")).taskCatalogModuleMock(),
);

vi.mock("../api/channels", () => ({
  listChannelsWithSources: vi.fn(async () => [
    {
      id: "ch-1",
      name: "頻道",
      platform: "telegram",
      platformId: "p1",
      sourceId: "a1",
      sourceName: "Acc",
      sourceStatus: "connected",
    },
  ]),
  fetchLatestByChannels: vi.fn(async () => ({})),
}));

const sampleConfig: BoardConfig = {
  version: 5,
  widgets: [
    { i: "w-map", type: "map", col: 0, row: 0, sizeId: "9x6" },
    { i: "w-gantt", type: "gantt", col: 0, row: 6, sizeId: "16x2" },
    { i: "w-events", type: "events", col: 0, row: 8, sizeId: "4x2" },
    { i: "w-wall", type: "wall", col: 9, row: 0, sizeId: "4x4" },
  ],
};

function Harness({
  initialMax = null as string | null,
  config = sampleConfig,
}: {
  initialMax?: string | null;
  config?: BoardConfig;
}) {
  const [maxId, setMaxId] = useState<string | null>(initialMax);
  return createElement(BoardCanvas, {
    config,
    editMode: "view",
    maximizedId: maxId,
    onConfigChange: () => {},
    onMaximize: setMaxId,
  });
}

describe("board heavy embed mount gating", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mapEmbedMount.mockClear();
    ganttEmbedMount.mockClear();
    wallEmbedMount.mockClear();
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
  });

  async function flushLazy() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await new Promise<void>((r) => queueMicrotask(() => r()));
    });
    await act(async () => {
      await Promise.resolve();
    });
  }

  it("mounts map and gantt embeds when all widgets are active", async () => {
    act(() => {
      root.render(wrapBoardProviders(createElement(Harness)));
    });
    await flushLazy();

    expect(container.querySelector('[data-testid="board-map-embed"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-gantt-embed"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-wall-embed"]')).toBeTruthy();
    expect(mapEmbedMount.mock.calls.length).toBeGreaterThan(0);
    expect(ganttEmbedMount.mock.calls.length).toBeGreaterThan(0);
    expect(wallEmbedMount.mock.calls.length).toBeGreaterThan(0);
  });

  it("unmounts obscured heavy embeds when another widget is maximized", async () => {
    act(() => {
      root.render(
        wrapBoardProviders(createElement(Harness, { initialMax: "w-events" })),
      );
    });
    await flushLazy();

    expect(container.querySelector('[data-testid="board-map-paused"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-gantt-paused"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-wall-paused"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-map-embed"]')).toBeNull();
    expect(container.querySelector('[data-testid="board-gantt-embed"]')).toBeNull();
    expect(container.querySelector('[data-testid="board-wall-embed"]')).toBeNull();
    // Widget shells stay mounted (maximize keep-mount).
    expect(container.querySelector('[data-widget-mount="w-map"]')).toBeTruthy();
    expect(container.querySelector('[data-widget-mount="w-gantt"]')).toBeTruthy();
    expect(container.querySelector('[data-widget-mount="w-events"]')).toBeTruthy();
  });

  it("does not mount map/wall embeds when monitorMode is pages", async () => {
    window.localStorage.setItem(MONITOR_MODE_KEY, "pages");
    act(() => {
      root.render(wrapBoardProviders(createElement(Harness)));
    });
    await flushLazy();

    expect(container.querySelector('[data-testid="board-map-embed"]')).toBeNull();
    expect(container.querySelector('[data-testid="board-wall-embed"]')).toBeNull();
    expect(container.querySelector('[data-testid="board-gantt-embed"]')).toBeNull();
    expect(container.querySelector('[data-testid="board-map-paused"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-wall-paused"]')).toBeTruthy();
    expect(mapEmbedMount.mock.calls.length).toBe(0);
    expect(wallEmbedMount.mock.calls.length).toBe(0);
  });
});

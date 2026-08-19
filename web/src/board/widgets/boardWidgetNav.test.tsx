import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MONITOR_MODE_KEY } from "../../context/MonitorModeContext";
import { EventsBoardWidget } from "./EventsBoardWidget";
import { FeedBoardWidget } from "./FeedBoardWidget";
import { CalendarBoardWidget, CalendarDayBoardWidget } from "./CalendarBoardWidget";
import { GanttBoardWidget } from "./GanttBoardWidget";
import { WallBoardWidget } from "./WallBoardWidget";
import { BoardWidgetFrame } from "../BoardWidgetFrame";
import { wrapBoardProviders } from "../boardTestHarness";
import type { BoardWidgetType } from "../types";
import {
  makeAnalysisTask,
  resetTaskCatalogState,
  taskCatalogState,
} from "../../test/context-mocks";

const openInPages = vi.fn();

vi.mock("../../context/MonitorModeContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../context/MonitorModeContext")>();
  return {
    ...actual,
    useMonitorMode: () => ({
      monitorMode: "canvas" as const,
      setMonitorMode: vi.fn(),
      openInPages,
    }),
  };
});

vi.mock("../../api/calendarWindow", () => ({
  fetchCalendarWindow: vi.fn(async () => [
    {
      id: "evt-1",
      source: "analysis",
      title: "事件一",
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 3_600_000).toISOString(),
      location: null,
      isAllDay: false,
      timezone: null,
      emoji: null,
      taskId: "t1",
      seriesId: null,
      worksetId: "__general__",
      itemId: null,
      origin: null,
      itemDateKind: null,
      notifyPref: "inherit",
      dismissed: false,
      important: false,
      taskName: "任務",
      isLastOccurrence: false,
      remindBeforeDays: null,
      body: "",
    },
  ]),
}));

vi.mock("../../api/results", () => ({
  fetchEvents: vi.fn(async () => ({
    items: [
      {
        id: "evt-1",
        taskId: "t1",
        version: 1,
        batchId: "b1",
        title: "事件一",
        body: "",
        startTime: new Date().toISOString(),
        endTime: new Date(Date.now() + 3_600_000).toISOString(),
        location: null,
        latitude: null,
        longitude: null,
        participants: [],
        sourceMessageId: null,
        sourcePlatform: "telegram",
        sourceChannelName: "頻道",
        sourceMessageTime: null,
        analysisTimeRange: null,
        batchSourceChannelNames: [],
        taskName: "任務",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    totalCount: 1,
    hasMore: false,
  })),
  fetchCalendarOccurrences: vi.fn(async () => []),
  fetchQueueStatus: vi.fn(async () => ({
    pendingCount: 0,
    processingBatches: [],
    attentionBatches: [],
    analysisPaused: false,
  })),
  fetchTaskAnalysisStats: vi.fn(async () => [
    {
      taskId: "t1",
      analyzedCount: 1,
      unanalyzedCount: 0,
      queuedMessageCount: 0,
    },
  ]),
  fetchTrendingTopics: vi.fn(async () => [
    {
      id: "topic-1",
      topicName: "Topic",
      rank: 1,
      score: 10,
      messageCount: 2,
      taskName: "任務",
    },
  ]),
}));

vi.mock("../../api/actions", () => ({
  listActions: vi.fn(async () => [
    {
      id: "act-1",
      name: "Action",
      actionType: "notify",
      isEnabled: true,
      lastTriggeredAt: null,
    },
  ]),
}));

vi.mock("../../api/sources", () => ({
  listSources: vi.fn(async () => [
    {
      id: "src-1",
      name: "Source",
      platform: "telegram",
      status: "connected",
    },
  ]),
}));

vi.mock("../../api/logs", () => ({
  queryAppLogsPage: vi.fn(async () => ({
    logs: [
      {
        id: "log-1",
        level: "info",
        category: "app",
        message: "hello",
        time: "2026-01-01T00:00:00.000Z",
        kind: null,
      },
    ],
    nextCursor: null,
    hasMore: false,
  })),
}));

vi.mock("../../api/messages", () => ({
  queryMessagesPage: vi.fn(async () => ({
    messages: [
      {
        id: "msg-1",
        sourceId: null,
        platform: "telegram",
        platformId: "c1",
        channelName: "頻道",
        platformMessageId: null,
        senderId: null,
        senderName: "Alice",
        content: "你好",
        timestamp: "2026-01-01T00:00:00.000Z",
        rawData: null,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    nextCursor: null,
    hasMore: false,
    totalCount: 1,
  })),
}));

vi.mock("../../api/tasks", () => ({
  fetchTaskActivitySpans: vi.fn(async () => {
    const start = new Date();
    start.setHours(8, 0, 0, 0);
    const end = new Date();
    end.setHours(16, 0, 0, 0);
    return [
      {
        taskId: "task-1",
        taskName: "任務活動",
        description: null,
        analysisTimeRange: "1d",
        isActive: true,
        earliestBatchStart: start.toISOString(),
        latestBatchEnd: end.toISOString(),
        completedBatchCount: 2,
      },
    ];
  }),
  listTasks: vi.fn(async () => [
    { id: "task-1", name: "任務活動", description: null, promptTemplate: "", analysisMode: "intel_event", analysisTimeRange: "1d", version: 1, isActive: true, channelIds: [], createdAt: "", updatedAt: "" },
  ]),
}));

vi.mock("../../api/userEvents", () => ({
  listUserEventsPage: vi.fn(async () => ({ items: [], totalCount: 0, hasMore: false })),
}));

vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock(),
);

vi.mock("../../context/AnalysisStatusContext", async () =>
  (await import("../../test/context-mocks")).analysisStatusModuleMock(),
);

vi.mock("../../api/channels", () => ({
  listChannelsWithSources: vi.fn(async () => [
    {
      id: "ch-1",
      platform: "telegram",
      platformId: "p1",
      name: "頻道一",
      sourceId: "acc-1",
      sourceName: "帳號",
    },
  ]),
}));

vi.mock("../../components/monitor/wall/useWallData", () => ({
  useWallData: () => ({
    channelById: {},
    selectedChannelIds: [] as string[],
    setSelectedChannelIds: vi.fn(),
    slots: {},
    initialLoading: false,
    error: null,
    advanceSlot: vi.fn(),
    setSlotIndex: vi.fn(),
  }),
}));

vi.mock("../../components/monitor/wall/useWallMediaCache", () => ({
  useWallMediaCache: () => ({
    get: vi.fn(),
    put: vi.fn(),
    revokeExcept: vi.fn(),
  }),
}));

/** Sync stub so Suspense/lazy does not flake under shared jsdom suite load. */
vi.mock("../embeds/GanttBoardEmbed", () => ({
  GanttBoardEmbed: ({
    spans,
  }: {
    spans?: Array<{ taskId: string }>;
  }) =>
    createElement(
      "div",
      { "data-testid": "board-gantt-embed" },
      (spans ?? []).map((span) =>
        createElement("button", {
          key: span.taskId,
          type: "button",
          "data-testid": `board-gantt-row-${span.taskId}`,
        }),
      ),
    ),
}));

/** Sync stub for calendar embeds (same Suspense flake under suite load). */
vi.mock("../embeds/CalendarBoardEmbed", () => ({
  CalendarBoardEmbed: ({
    mode,
    events,
  }: {
    mode: "day" | "month";
    events?: Array<{ title?: string }>;
  }) =>
    createElement(
      "div",
      {
        "data-testid": mode === "day" ? "board-calendar-day" : "board-calendar-month",
        className: mode === "day" ? "board-calendar-day" : "board-calendar-month",
      },
      (events ?? []).map((row, index) =>
        createElement("span", { key: `${row.title ?? "evt"}-${index}` }, row.title ?? ""),
      ),
    ),
}));

describe("board widget in-frame interactions", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    openInPages.mockReset();
    resetTaskCatalogState([
      makeAnalysisTask({ id: "task-1", name: "任務活動", analysisMode: "intel_event" }),
    ]);
    taskCatalogState.worksets = [
      {
        id: "__general__",
        name: "一般",
        createdAt: "1970-01-01T00:00:00Z",
        updatedAt: "1970-01-01T00:00:00Z",
      },
    ];
    window.localStorage.setItem(MONITOR_MODE_KEY, "canvas");
    // jsdom does not implement Element.scrollIntoView; EventsBoardWidget
    // guards for it, but stub anyway so focus-scroll paths are exercisable.
    Element.prototype.scrollIntoView = vi.fn();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
    window.localStorage.clear();
  });

  async function flush() {
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
  }

  /** Wait for lazy embeds to resolve. */
  async function flushLazy() {
    await flush();
    await act(async () => {
      await new Promise<void>((resolve) => {
        queueMicrotask(() => resolve());
      });
    });
    await flush();
  }

  /** Wall-clock poll (not microtask-only) so suite load cannot starve Suspense. */
  async function waitForSelector(selector: string, timeoutMs = 2000): Promise<Element | null> {
    const started = Date.now();
    while (Date.now() - started <= timeoutMs) {
      const node = container.querySelector(selector);
      if (node) {
        return node;
      }
      await act(async () => {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, 20);
        });
      });
    }
    return container.querySelector(selector);
  }

  function wrap(node: React.ReactNode) {
    return wrapBoardProviders(node);
  }

  function inFrame(type: BoardWidgetType, node: React.ReactNode) {
    return wrap(
      createElement(
        BoardWidgetFrame,
        {
          widgetId: `test-${type}`,
          type,
          editMode: false,
          maximized: false,
          sizeId: type === "gantt" || type === "gantt-events" ? "10x2" : type === "wall" ? "4x3" : "4x2",
          onSizeChange: vi.fn(),
          onMaximize: vi.fn(),
          onMinimize: vi.fn(),
          onRemove: vi.fn(),
        },
        node,
      ),
    );
  }

  it("Events row stays on the board", async () => {
    act(() => {
      root.render(wrap(createElement(EventsBoardWidget)));
    });
    await flush();
    act(() => {
      (container.querySelector('[data-testid="board-events-row-evt-1"]') as HTMLButtonElement).click();
    });
    expect(openInPages).not.toHaveBeenCalled();
  });

  it("Feed row is display-only (no fake button / no openInPages)", async () => {
    act(() => {
      root.render(wrap(createElement(FeedBoardWidget)));
    });
    await flush();
    const row = container.querySelector('[data-testid="board-feed-row-msg-1"]');
    expect(row).toBeTruthy();
    expect(row?.tagName.toLowerCase()).not.toBe("button");
    expect(openInPages).not.toHaveBeenCalled();
  });

  it("Queue / Stats / Tasks / Actions / Sources / Leaderboard / Logs rows are not buttons", async () => {
    const { analysisStatusState } = await import("../../test/context-mocks");
    analysisStatusState.queueStatus = {
      pendingCount: 1,
      processingBatches: [
        {
          batchId: "b1",
          taskName: "Task",
          messageCount: 2,
          status: "processing",
          retryCount: 0,
        },
      ],
      attentionBatches: [],
      analysisPaused: false,
    };

    const { QueueBoardWidget } = await import("./QueueBoardWidget");
    const { StatsBoardWidget } = await import("./StatsBoardWidget");
    const { TasksBoardWidget } = await import("./TasksBoardWidget");
    const { ActionsBoardWidget } = await import("./ActionsBoardWidget");
    const { SourcesBoardWidget } = await import("./SourcesBoardWidget");
    const { LeaderboardBoardWidget } = await import("./LeaderboardBoardWidget");
    const { LogsBoardWidget } = await import("./LogsBoardWidget");

    const cases: Array<{ node: React.ReactNode; selectors: string[] }> = [
      {
        node: createElement(QueueBoardWidget),
        selectors: ['[data-testid="board-queue-stats"]', '[data-testid="board-queue-row-b1"]'],
      },
      {
        node: createElement(StatsBoardWidget),
        selectors: ['[data-testid="board-stats-totals"]', '[data-testid="board-stats-row-t1"]'],
      },
      {
        node: createElement(TasksBoardWidget),
        selectors: ['[data-testid="board-tasks-row-task-1"]'],
      },
      {
        node: createElement(ActionsBoardWidget),
        selectors: ['[data-testid="board-actions-row-act-1"]'],
      },
      {
        node: createElement(SourcesBoardWidget),
        selectors: ['[data-testid="board-sources-row-src-1"]'],
      },
      {
        node: createElement(LeaderboardBoardWidget),
        selectors: ['[data-testid="board-leaderboard-row-topic-1"]'],
      },
      {
        node: createElement(LogsBoardWidget),
        selectors: ['[data-testid="board-logs-row-log-1"]'],
      },
    ];

    for (const { node, selectors } of cases) {
      act(() => {
        root.render(wrap(node));
      });
      await flush();
      await flush();
      for (const selector of selectors) {
        const el = container.querySelector(selector);
        expect(el, selector).toBeTruthy();
        expect(el!.tagName.toLowerCase()).not.toBe("button");
      }
      expect(openInPages).not.toHaveBeenCalled();
    }
  });

  it("calendar frames expose source filter without day/month view toggles", async () => {
    act(() => {
      root.render(inFrame("calendar", createElement(CalendarBoardWidget, { widgetId: "test-calendar" })));
    });
    await flushLazy();
    const sourceFilter = container.querySelector(
      '[data-testid="board-source-filter"]',
    ) as HTMLButtonElement | null;
    expect(sourceFilter?.closest(".board-widget-frame__header")).toBeTruthy();
    expect(container.querySelector('[data-testid="board-calendar-view-day"]')).toBeNull();
    expect(container.querySelector('[data-testid="board-calendar-view-month"]')).toBeNull();
    expect(container.querySelector(".board-widget-footer")).toBeNull();

    act(() => {
      root.render(
        inFrame("calendar-day", createElement(CalendarDayBoardWidget, { widgetId: "test-calendar-day" })),
      );
    });
    await flushLazy();
    expect(await waitForSelector('[data-testid="board-calendar-day"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-calendar-view-day"]')).toBeNull();
    expect(container.querySelector('[data-testid="board-calendar-view-month"]')).toBeNull();
    // Merged timed feed includes analysis and/or calendar rows for today.
    expect(
      container.textContent?.includes("會議") || container.textContent?.includes("事件一"),
    ).toBe(true);
  });

  it("Events header mounts the shared source filter control", async () => {
    act(() => {
      root.render(inFrame("events", createElement(EventsBoardWidget, { widgetId: "test-events" })));
    });
    await flush();
    const sourceFilter = container.querySelector(
      '[data-testid="board-source-filter"]',
    ) as HTMLButtonElement | null;
    expect(sourceFilter?.closest(".board-widget-frame__header")).toBeTruthy();
  });

  it("Gantt task row does not open the timeline", async () => {
    act(() => {
      root.render(inFrame("gantt", createElement(GanttBoardWidget, { widgetId: "test-gantt" })));
    });
    await flushLazy();
    const dayView = (await waitForSelector(
      '[data-testid="board-gantt-view-day"]',
    )) as HTMLButtonElement | null;
    expect(dayView).toBeTruthy();
    expect(dayView?.closest(".board-widget-frame__header")).toBeTruthy();
    expect(container.querySelector('[data-testid="board-gantt-view-month"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-gantt-view-month-full"]')).toBeNull();
    expect(
      container.querySelector('[data-testid="board-source-filter"]')?.closest(
        ".board-widget-frame__header",
      ),
    ).toBeTruthy();
    expect(await waitForSelector('[data-testid="board-gantt-embed"]')).toBeTruthy();
    expect(container.querySelector(".board-widget-footer")).toBeNull();
    act(() => {
      dayView!.click();
    });
    expect(dayView?.getAttribute("aria-pressed")).toBe("true");
    const row = (await waitForSelector(
      '[data-testid="board-gantt-row-task-1"]',
    )) as HTMLButtonElement | null;
    expect(row).toBeTruthy();
    act(() => {
      row!.click();
    });
    expect(openInPages).not.toHaveBeenCalled();
  });

  it("Wall scope picker lives in the frame header, not body toolbar", async () => {
    act(() => {
      root.render(inFrame("wall", createElement(WallBoardWidget)));
    });
    await flushLazy();
    const trigger = await waitForSelector('[data-testid="wall-channel-picker-trigger"]');
    expect(trigger).toBeTruthy();
    expect(trigger?.closest(".board-widget-frame__header")).toBeTruthy();
    expect(container.querySelector(".board-wall-embed__toolbar")).toBeNull();
  });
});

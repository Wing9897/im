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
  fetchCalendarOccurrences: vi.fn(async () => [
    {
      id: "cal-1",
      taskId: "cal-task-1",
      title: "會議",
      taskName: "循環任務",
      // Distinct from analysis mock startTime so merge dedupe keeps both rows.
      startTime: new Date(Date.now() + 3_600_000).toISOString(),
      endTime: new Date(Date.now() + 7_200_000).toISOString(),
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

vi.mock("../../api/messages", () => ({
  queryMessagesPage: vi.fn(async () => ({
    messages: [
      {
        id: "msg-1",
        accountId: null,
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
        analysisTimeRange: "24h",
        isActive: true,
        earliestBatchStart: start.toISOString(),
        latestBatchEnd: end.toISOString(),
        completedBatchCount: 2,
      },
    ];
  }),
  listTasks: vi.fn(async () => [
    { id: "task-1", name: "任務活動", description: null, promptTemplate: "", analysisMode: "event", analysisTimeRange: "24h", version: 1, isActive: true, channelIds: [], createdAt: "", updatedAt: "" },
  ]),
}));

vi.mock("../../api/userEvents", () => ({
  listUserEvents: vi.fn(async () => []),
}));

vi.mock("../../context/TaskCatalogContext", async () =>
  (await import("../../test/context-mocks")).taskCatalogModuleMock(),
);

vi.mock("../../context/AnalysisStatusContext", async () =>
  (await import("../../test/context-mocks")).analysisStatusModuleMock(),
);

vi.mock("../../api/channels", () => ({
  listChannelsWithAccounts: vi.fn(async () => [
    {
      id: "ch-1",
      platform: "telegram",
      platformId: "p1",
      name: "頻道一",
      accountId: "acc-1",
      accountName: "帳號",
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
    occurrences,
  }: {
    mode: "day" | "month";
    occurrences?: Array<{ title?: string }>;
  }) =>
    createElement(
      "div",
      {
        "data-testid": mode === "day" ? "board-calendar-day" : "board-calendar-month",
        className: mode === "day" ? "board-calendar-day" : "board-calendar-month",
      },
      (occurrences ?? []).map((row, index) =>
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
      makeAnalysisTask({ id: "task-1", name: "任務活動", analysisMode: "event" }),
    ]);
    taskCatalogState.worksets = [
      {
        id: "__user__",
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

  it("Feed row stays on the board", async () => {
    act(() => {
      root.render(wrap(createElement(FeedBoardWidget)));
    });
    await flush();
    act(() => {
      (container.querySelector('[data-testid="board-feed-row-msg-1"]') as HTMLButtonElement).click();
    });
    expect(openInPages).not.toHaveBeenCalled();
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

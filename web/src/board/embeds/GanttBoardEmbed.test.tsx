import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AnalysisEvent, TaskActivitySpan } from "../../types";
import {
  GanttBoardEmbed,
  buildGanttAxis,
  calculateBar,
  normalizeGanttActivities,
  normalizeGanttEventActivities,
} from "./GanttBoardEmbed";

/** Local calendar helpers — avoid UTC ISO pitfalls in positioning tests. */
function localIso(y: number, m0: number, d: number, h = 0, min = 0): string {
  return new Date(y, m0, d, h, min, 0, 0).toISOString();
}

function makeSpan(overrides: Partial<TaskActivitySpan> = {}): TaskActivitySpan {
  return {
    taskId: "task-1",
    taskName: "資料彙整",
    description: null,
    analysisTimeRange: "24h",
    isActive: true,
    earliestBatchStart: localIso(2026, 6, 21, 10, 0),
    latestBatchEnd: localIso(2026, 6, 21, 11, 0),
    completedBatchCount: 1,
    ...overrides,
  };
}

/** Local AnalysisEvent fixture for this file (not timelineTestHelpers.makeEvent). */
function makeEvent(overrides: Partial<AnalysisEvent> = {}): AnalysisEvent {
  return {
    id: "evt-1",
    taskId: "task-1",
    version: 1,
    batchId: "b1",
    title: "事件甲",
    body: "",
    startTime: localIso(2026, 6, 10, 9, 0),
    endTime: localIso(2026, 6, 10, 11, 0),
    location: null,
    latitude: null,
    longitude: null,
    participants: [],
    sourceMessageId: null,
    sourcePlatform: null,
    sourceChannelName: null,
    sourceMessageTime: null,
    analysisTimeRange: null,
    batchSourceChannelNames: [],
    taskName: "資料彙整",
    createdAt: localIso(2026, 6, 1, 0, 0),
    updatedAt: localIso(2026, 6, 1, 0, 0),
    ...overrides,
  };
}

describe("buildGanttAxis", () => {
  it("anchors day view to today with 24 hourly cells", () => {
    const axis = buildGanttAxis("day", new Date(2026, 6, 22, 18, 0, 0).getTime());
    expect(axis.tickCount).toBe(24);
    expect(axis.cellMs).toBe(60 * 60 * 1000);
    expect(axis.ticks).toHaveLength(24);
    expect(new Date(axis.start).getHours()).toBe(0);
    expect(new Date(axis.start).getDate()).toBe(22);
  });

  it("anchors month view to the current month with one cell per day", () => {
    const axis = buildGanttAxis("month", new Date(2026, 6, 22, 18, 0, 0).getTime());
    expect(axis.tickCount).toBe(31);
    expect(axis.cellMs).toBe(24 * 60 * 60 * 1000);
    expect(axis.ticks).toHaveLength(31);
    expect(new Date(axis.start).getDate()).toBe(1);
    expect(new Date(axis.end).getMonth()).toBe(7);
  });
});

describe("calculateBar cell snapping", () => {
  const now = new Date(2026, 6, 22, 18, 0, 0).getTime();

  it("month: same-day short span fills the whole day cell (not a thin sliver)", () => {
    const axis = buildGanttAxis("month", now);
    const [activity] = normalizeGanttActivities([makeSpan()]);
    const bar = calculateBar(activity!, axis);
    expect(bar).toBeTruthy();
    // July 21 → cell index 20
    expect(bar!.startCell).toBe(20);
    expect(bar!.endCell).toBe(21);
    expect(bar!.left).toBeCloseTo((20 / 31) * 100, 5);
    expect(bar!.width).toBeCloseTo((1 / 31) * 100, 5);
  });

  it("month: multi-day span covers inclusive day cells", () => {
    const axis = buildGanttAxis("month", now);
    const [activity] = normalizeGanttActivities([
      makeSpan({
        earliestBatchStart: localIso(2026, 6, 20, 12, 0),
        latestBatchEnd: localIso(2026, 6, 22, 18, 0),
      }),
    ]);
    const bar = calculateBar(activity!, axis);
    expect(bar!.startCell).toBe(19); // day 20
    expect(bar!.endCell).toBe(22); // exclusive → through day 22
    expect(bar!.width).toBeCloseTo((3 / 31) * 100, 5);
  });

  it("month: point event (start===end) still occupies one day cell", () => {
    const axis = buildGanttAxis("month", now);
    const point = localIso(2026, 6, 5, 15, 30);
    const [activity] = normalizeGanttActivities([
      makeSpan({ earliestBatchStart: point, latestBatchEnd: point }),
    ]);
    const bar = calculateBar(activity!, axis);
    expect(bar!.startCell).toBe(4); // day 5
    expect(bar!.endCell).toBe(5);
    expect(bar!.width).toBeCloseTo((1 / 31) * 100, 5);
  });

  it("day: short span snaps to the correct hour cell", () => {
    const axis = buildGanttAxis("day", now);
    const [activity] = normalizeGanttActivities([
      makeSpan({
        earliestBatchStart: localIso(2026, 6, 22, 8, 15),
        latestBatchEnd: localIso(2026, 6, 22, 8, 45),
      }),
    ]);
    const bar = calculateBar(activity!, axis);
    expect(bar!.startCell).toBe(8);
    expect(bar!.endCell).toBe(9);
    expect(bar!.left).toBeCloseTo((8 / 24) * 100, 5);
    expect(bar!.width).toBeCloseTo((1 / 24) * 100, 5);
  });

  it("day: multi-hour span covers start hour through end hour", () => {
    const axis = buildGanttAxis("day", now);
    const [activity] = normalizeGanttActivities([
      makeSpan({
        earliestBatchStart: localIso(2026, 6, 22, 8, 0),
        latestBatchEnd: localIso(2026, 6, 22, 16, 0),
      }),
    ]);
    const bar = calculateBar(activity!, axis);
    expect(bar!.startCell).toBe(8);
    expect(bar!.endCell).toBe(16);
    expect(bar!.width).toBeCloseTo((8 / 24) * 100, 5);
  });

  it("live API twin tasks keep independent timestamps and share their real local day cell", () => {
    const liveSpans: TaskActivitySpan[] = [
      {
        taskId: "bd1a07747bc940c1974196c996582fc7",
        taskName: "薅羊毛情報",
        description: null,
        analysisTimeRange: "24h",
        isActive: true,
        earliestBatchStart: "2026-07-21T14:28:11Z",
        latestBatchEnd: "2026-07-21T14:39:04Z",
        completedBatchCount: 9,
      },
      {
        taskId: "fb5fdcf95ab14c75bca547aa1978113f",
        taskName: "行程事件提取",
        description: null,
        analysisTimeRange: "7d",
        isActive: true,
        earliestBatchStart: "2026-07-21T14:28:17Z",
        latestBatchEnd: "2026-07-21T14:39:10Z",
        completedBatchCount: 9,
      },
    ];
    const nowMs = new Date(2026, 6, 22, 18, 0, 0).getTime();
    const axis = buildGanttAxis("month", nowMs);
    const activities = normalizeGanttActivities(liveSpans, nowMs);
    expect(activities).toHaveLength(2);
    expect(activities[0]!.start).toBe(Date.parse("2026-07-21T14:28:11Z"));
    expect(activities[1]!.start).toBe(Date.parse("2026-07-21T14:28:17Z"));
    expect(activities[0]!.start).not.toBe(activities[1]!.start);
    expect(activities[0]!.end).not.toBe(nowMs);
    expect(activities[1]!.end).not.toBe(nowMs);

    const day0 = new Date(activities[0]!.start).getDate();
    const day1 = new Date(activities[1]!.start).getDate();
    expect(day0).toBe(day1);

    for (const activity of activities) {
      const bar = calculateBar(activity, axis)!;
      expect(bar.startCell).toBe(day0 - 1);
      expect(bar.endCell).toBe(day0);
      expect(bar.width).toBeCloseTo((1 / 31) * 100, 5);
    }
  });

  it("different real days stay on different cells (no clamp-to-today)", () => {
    const axis = buildGanttAxis("month", now);
    const activities = normalizeGanttActivities([
      makeSpan({
        taskId: "a",
        earliestBatchStart: localIso(2026, 6, 5, 9, 0),
        latestBatchEnd: localIso(2026, 6, 5, 10, 0),
      }),
      makeSpan({
        taskId: "b",
        earliestBatchStart: localIso(2026, 6, 18, 9, 0),
        latestBatchEnd: localIso(2026, 6, 18, 10, 0),
      }),
    ]);
    expect(calculateBar(activities[0]!, axis)!.startCell).toBe(4);
    expect(calculateBar(activities[1]!, axis)!.startCell).toBe(17);
  });
});

describe("normalizeGanttEventActivities", () => {
  it("maps events to rows and uses min one-day cell when end is missing", () => {
    const now = new Date(2026, 6, 22, 18, 0, 0).getTime();
    const activities = normalizeGanttEventActivities([
      makeEvent({ endTime: null }),
      makeEvent({ id: "evt-2", taskId: "task-2", title: "事件乙", startTime: localIso(2026, 6, 15, 12, 0) }),
    ], now);
    expect(activities).toHaveLength(2);
    expect(activities[0]!.label).toBe("事件甲");
    expect(activities[0]!.segments).toHaveLength(1);
    expect(activities[0]!.segments[0]!.end).toBe(activities[0]!.segments[0]!.start);
    const axis = buildGanttAxis("month", now);
    const bar = calculateBar(activities[0]!.segments[0]!, axis)!;
    expect(bar.width).toBeCloseTo((1 / 31) * 100, 5);
  });

  it("skips events without startTime", () => {
    expect(normalizeGanttEventActivities([makeEvent({ startTime: null })])).toHaveLength(0);
  });

  it("merges recurring occurrences with the same taskId into one row with multiple segments", () => {
    const now = new Date(2026, 6, 22, 18, 0, 0).getTime();
    const rows = normalizeGanttEventActivities([
      makeEvent({
        id: "meet:1",
        taskId: "meet",
        title: "開會",
        source: "recurring",
        startTime: localIso(2026, 6, 8, 9, 0),
        endTime: localIso(2026, 6, 8, 10, 0),
      }),
      makeEvent({
        id: "meet:2",
        taskId: "meet",
        title: "開會",
        source: "recurring",
        startTime: localIso(2026, 6, 15, 9, 0),
        endTime: localIso(2026, 6, 15, 10, 0),
      }),
      makeEvent({
        id: "other",
        taskId: "other-task",
        title: "單次",
        startTime: localIso(2026, 6, 10, 9, 0),
      }),
    ], now);
    expect(rows).toHaveLength(2);
    expect(rows[0]!.id).toBe("recurring:meet");
    expect(rows[0]!.segments).toHaveLength(2);
    expect(rows[1]!.id).toBe("other");
    expect(rows[1]!.segments).toHaveLength(1);
  });
});

describe("GanttBoardEmbed", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 22, 18, 0, 0));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
    vi.useRealTimers();
  });

  function render(
    props: {
      spans?: TaskActivitySpan[];
      events?: AnalysisEvent[];
      viewMode: "day" | "month";
      emptyLabel?: string;
    },
  ) {
    act(() => {
      root.render(createElement(GanttBoardEmbed, {
        ...props,
        onSelectActivity: vi.fn(),
      }));
    });
  }

  it("renders month bars snapped to the correct day cell with full-cell width", () => {
    render({ spans: [makeSpan()], viewMode: "month" });

    const bar = container.querySelector('[data-testid="board-gantt-bar-task-1"]') as HTMLElement;
    expect(bar).toBeTruthy();
    expect(bar.getAttribute("data-start-cell")).toBe("20");
    expect(bar.getAttribute("data-end-cell")).toBe("21");
    expect(Number.parseFloat(bar.style.left)).toBeCloseTo((20 / 31) * 100, 5);
    expect(Number.parseFloat(bar.style.width)).toBeCloseTo((1 / 31) * 100, 5);
    expect(container.querySelector('[aria-label="月時間軸"]')?.children).toHaveLength(31);
  });

  it("renders day bars snapped to the correct hour cell", () => {
    render({
      spans: [
        makeSpan({
          earliestBatchStart: localIso(2026, 6, 22, 8, 0),
          latestBatchEnd: localIso(2026, 6, 22, 16, 0),
        }),
      ],
      viewMode: "day",
    });

    const bar = container.querySelector('[data-testid="board-gantt-bar-task-1"]') as HTMLElement;
    expect(bar.getAttribute("data-start-cell")).toBe("8");
    expect(bar.getAttribute("data-end-cell")).toBe("16");
    expect(Number.parseFloat(bar.style.left)).toBeCloseTo((8 / 24) * 100, 5);
    expect(Number.parseFloat(bar.style.width)).toBeCloseTo((8 / 24) * 100, 5);
    expect(container.querySelector('[aria-label="日時間軸"]')?.children).toHaveLength(24);
  });

  it("keeps the chart chrome when there are no activities", () => {
    render({ spans: [], viewMode: "month" });

    expect(container.querySelector('[aria-label="月時間軸"]')?.children).toHaveLength(31);
    expect(container.querySelector(".board-gantt-embed__empty")?.textContent).toContain("尚無任務活動");
  });

  it("renders event rows and shows 尚無事件 when empty", () => {
    render({ events: [makeEvent()], viewMode: "month", emptyLabel: "尚無事件" });
    expect(container.querySelector('[data-testid="board-gantt-row-evt-1"]')).toBeTruthy();

    render({ events: [], viewMode: "month", emptyLabel: "尚無事件" });
    expect(container.querySelector(".board-gantt-embed__empty")?.textContent).toContain("尚無事件");
  });

  it("filters task rows by selected task ids (caller-side)", () => {
    render({
      spans: [
        makeSpan({ taskId: "task-2", taskName: "B", earliestBatchStart: localIso(2026, 6, 12, 10, 0), latestBatchEnd: localIso(2026, 6, 12, 11, 0) }),
      ],
      viewMode: "month",
    });
    expect(container.querySelector('[data-testid="board-gantt-row-task-2"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="board-gantt-row-task-1"]')).toBeNull();
  });
});

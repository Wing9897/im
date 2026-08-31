import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import {
  buildQuarterWeeks,
  buildYearGanttColumns,
  startOfQuarter,
  startOfYear,
  type GanttColumn,
  type TimelineScale,
} from "../../../domain/timeline/dateUtils";
import { EVENT_STATUS_COLORS } from "../../../domain/timeline/status";
import {
  makeEvent,
  makeDayColumns,
  makeWeekColumns,
  makeMonthColumns,
} from "../../../test/timelineTestHelpers";
import { computeEventBarPosition } from "./ganttEventPositioning";
import { ensureZhHantLocale, wrapWithI18n } from "../../../test/i18nHarness";

const { TimelineGanttView } = await import("./TimelineGanttView");

function eventBar(container: ParentNode, eventId: string): HTMLElement | null {
  return container.querySelector(`[data-testid="event-bar-${eventId}"]`);
}

function makeQuarterColumns(rangeStart: Date): GanttColumn[] {
  return buildQuarterWeeks(rangeStart).map((weekStart) => ({
    key: weekStart.toISOString(),
    label: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
    day: weekStart,
  }));
}

type Props = Parameters<typeof TimelineGanttView>[0];

/** Expected CSS grid-column from the same positioning used by GanttEventRow. */
function expectedGridColumn(
  startTime: string,
  endTime: string | null,
  timeScale: TimelineScale,
  rangeStart: Date,
  columnCount: number,
): string {
  const pos = computeEventBarPosition(
    new Date(startTime),
    endTime ? new Date(endTime) : null,
    timeScale,
    rangeStart,
    columnCount,
  );
  return `${pos.startColumn} / ${pos.endColumn + 1}`;
}

function makeProps(overrides: Partial<Props> = {}): Props {
  return {
    events: [makeEvent()],
    initialLoading: false,
    isRefreshing: false,
    error: null,
    timeScale: "day",
    ganttColumns: makeDayColumns(),
    rangeStart: new Date("2025-01-15T00:00:00Z"),
    onRetry: vi.fn(),
    ...overrides,
  };
}

function render(props: Props) {
  const container = document.createElement("div");
  act(() => {
    createRoot(container).render(
      wrapWithI18n(createElement(TimelineGanttView, props)),
    );
  });
  return container;
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("TimelineGanttView", () => {
  beforeEach(async () => {
    await ensureZhHantLocale();
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("empty state rendering", () => {
    it("renders empty state message when there are no events (Requirement 2.1)", () => {
      const container = render(makeProps({ events: [] }));
      expect(container.textContent).toContain("目前沒有排程事件");
    });

    it("keeps gantt framework visible when task has no events", () => {
      const container = render(makeProps({ events: [] }));
      expect(container.textContent).toContain("事件");
      expect(container.querySelector('[data-testid^="event-row-"]')).toBeNull();
    });
  });

  describe("error state rendering", () => {
    it("renders error message and retry button (Requirement 1.4)", () => {
      const onRetry = vi.fn();
      const container = render(
        makeProps({ error: "載入失敗", events: [], onRetry }),
      );
      expect(container.textContent).toContain("載入失敗");
      expect(container.textContent).toContain("重試");

      // Click retry button
      const button = container.querySelector("button") as HTMLButtonElement;
      expect(button).not.toBeNull();
      act(() => {
        button.click();
      });
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe("loading state rendering", () => {
    it("renders loading indicator while fetching", () => {
      const container = render(makeProps({ initialLoading: true }));
      expect(container.textContent).toContain("載入排程事件中");
    });

    it("keeps gantt content visible while refreshing", () => {
      const container = render(
        makeProps({ isRefreshing: true, events: [makeEvent({ title: "Refresh Event" })] }),
      );
      expect(container.textContent).toContain("Refresh Event");
      // Refresh spinner lives in the page toolbar; gantt keeps the chart mounted.
      expect(container.querySelector('[data-testid="gantt-refresh-indicator"]')).toBeNull();
      const gantt = container.querySelector('[data-testid="timeline-gantt-view"]');
      expect(gantt).not.toBeNull();
      expect(gantt?.className).toContain("im-timeline-gantt");
    });

    it("provides a vertical scroll region for many event rows", () => {
      const events = Array.from({ length: 12 }, (_, index) =>
        makeEvent({
          id: `evt-${index}`,
          title: `Event ${index}`,
          startTime: `2025-01-15T${String(index).padStart(2, "0")}:00:00Z`,
          endTime: `2025-01-15T${String(index).padStart(2, "0")}:30:00Z`,
        }),
      );
      const container = render(makeProps({ events }));
      const scroll = container.querySelector('[data-testid="gantt-vertical-scroll"]');
      expect(scroll).not.toBeNull();
      expect((scroll as HTMLElement).className).toContain("overflow-y-auto");
      expect(container.querySelectorAll('[data-testid^="event-row-"]')).toHaveLength(12);
    });
  });

  describe("event row rendering", () => {
    it("renders one Event_Row per visible non-recurring TimelineItem (Requirement 3.1)", () => {
      const events = [
        makeEvent({ id: "evt-1", title: "Event A" }),
        makeEvent({ id: "evt-2", title: "Event B", startTime: "2025-01-15T12:00:00Z", endTime: "2025-01-15T14:00:00Z" }),
        makeEvent({ id: "evt-3", title: "Event C", startTime: "2025-01-15T16:00:00Z", endTime: "2025-01-15T18:00:00Z" }),
      ];
      const container = render(makeProps({ events }));
      expect(container.textContent).toContain("Event A");
      expect(container.textContent).toContain("Event B");
      expect(container.textContent).toContain("Event C");

      const rows = container.querySelectorAll('[data-testid^="event-row-"]');
      expect(rows.length).toBe(3);
    });

    it("renders recurring calendar occurrences as a series row with status-colored bars", () => {
      const calEvent = makeEvent({
        id: "cal-evt-1",
        seriesId: "cal-task-1",
        title: "Weekly Standup",
        source: "recurring",
        startTime: "2025-01-15T09:00:00Z",
        endTime: "2025-01-15T12:00:00Z",
      });
      const container = render(makeProps({ events: [calEvent] }));
      const row = container.querySelector('[data-testid="event-row-recurring:cal-task-1"]');
      expect(row).not.toBeNull();
      expect(container.textContent).toContain("Weekly Standup");
      const bars = row!.querySelectorAll('[data-testid^="event-bar-"]');
      expect(bars.length).toBeGreaterThan(0);
      expect((bars[0] as HTMLElement).getAttribute("data-status")).toBe("pending");
      expect((bars[0] as HTMLElement).style.backgroundColor).toBeTruthy();
    });

    it("merges recurring occurrences with the same seriesId into one row with multiple bars", () => {
      const events = [
        makeEvent({
          id: "meet:0900",
          seriesId: "meet",
          title: "開會",
          source: "recurring",
          startTime: "2025-01-15T09:00:00Z",
          endTime: "2025-01-15T10:00:00Z",
        }),
        makeEvent({
          id: "meet:1500",
          seriesId: "meet",
          title: "開會",
          source: "recurring",
          startTime: "2025-01-15T15:00:00Z",
          endTime: "2025-01-15T16:00:00Z",
        }),
        makeEvent({
          id: "analysis-1",
          title: "Analysis",
          startTime: "2025-01-15T12:00:00Z",
          endTime: "2025-01-15T13:00:00Z",
        }),
      ];
      const container = render(makeProps({ events }));
      expect(container.querySelectorAll('[data-testid^="event-row-"]')).toHaveLength(2);
      expect(container.querySelector('[data-testid="event-row-recurring:meet"]')).not.toBeNull();
      expect(container.querySelectorAll('[data-testid^="event-bar-"]')).toHaveLength(3);
      expect(container.querySelector('[data-testid="event-bar-meet:0900"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="event-bar-meet:1500"]')).not.toBeNull();
    });

    it("renders exactly N Event_Row elements for N non-recurring events (one-to-one mapping)", () => {
      for (const count of [1, 3, 5]) {
        const events = Array.from({ length: count }, (_, i) =>
          makeEvent({
            id: `evt-count-${i}`,
            title: `Event ${i}`,
            startTime: `2025-01-15T${String(i % 24).padStart(2, "0")}:00:00Z`,
            endTime: `2025-01-15T${String(i % 24).padStart(2, "0")}:30:00Z`,
          }),
        );
        const container = render(makeProps({ events }));
        const rows = container.querySelectorAll('[data-testid^="event-row-"]');
        expect(rows.length).toBe(count);
      }
    });

    it("each Event_Row has a unique data-testid matching event id", () => {
      const events = [
        makeEvent({ id: "evt-a", startTime: "2025-01-15T09:00:00Z", endTime: "2025-01-15T10:00:00Z" }),
        makeEvent({ id: "evt-b", startTime: "2025-01-15T12:00:00Z", endTime: "2025-01-15T13:00:00Z" }),
        makeEvent({ id: "evt-c", startTime: "2025-01-15T15:00:00Z", endTime: "2025-01-15T16:00:00Z" }),
      ];
      const container = render(makeProps({ events }));
      const rows = container.querySelectorAll('[data-testid^="event-row-"]');
      const testIds = Array.from(rows).map((row) => row.getAttribute("data-testid"));

      expect(testIds).toEqual(["event-row-evt-a", "event-row-evt-b", "event-row-evt-c"]);
      expect(new Set(testIds).size).toBe(testIds.length);
    });

    it("renders long event titles with CSS ellipsis overflow (Requirement 3.4)", () => {
      const longTitle = "This is a very long event title that exceeds twenty characters";
      const container = render(
        makeProps({ events: [makeEvent({ title: longTitle })] }),
      );
      // Full title (+ time) is available via title attribute for hover tooltip
      const titleEl = container.querySelector(`[title^="${longTitle}"]`);
      expect(titleEl).not.toBeNull();
      expect(titleEl!.textContent).toContain(longTitle);
      // Title text lives in an inner truncate span within the fixed-width label column
      const truncated = Array.from(titleEl!.querySelectorAll("span")).find((el) =>
        el.className.includes("truncate"),
      );
      expect(truncated).toBeDefined();
      expect(truncated!.textContent).toBe(longTitle);
    });

    it("shows full title on hover via title attribute (Requirement 3.4)", () => {
      const longTitle = "This is a very long event title that exceeds twenty characters";
      const container = render(
        makeProps({ events: [makeEvent({ title: longTitle })] }),
      );
      const labelDiv = container.querySelector(`[title^="${longTitle}"]`);
      expect(labelDiv).not.toBeNull();
      expect(labelDiv!.getAttribute("title")).toContain(longTitle);
    });
  });

  describe("time axis rendering", () => {
    it("renders column headers from ganttColumns", () => {
      const container = render(makeProps());
      // Day scale: 24 hour columns (00, 01, ..., 23)
      expect(container.textContent).toContain("00");
      expect(container.textContent).toContain("12");
      expect(container.textContent).toContain("23");
    });

    it("renders '事件' label in the first column header", () => {
      const container = render(makeProps());
      expect(container.textContent).toContain("事件");
    });
  });

  describe("color legend rendering", () => {
    it("renders Color Legend with all 4 statuses (Requirement 7.5)", () => {
      const container = render(makeProps());
      expect(container.textContent).toContain("待確認");
      expect(container.textContent).toContain("已確認");
      expect(container.textContent).toContain("已完成");
      expect(container.textContent).toContain("已取消");
    });
  });

  describe("event bar rendering", () => {
    it("does not show trim handles on discrete 日/週/月/季/年 gantt", () => {
      const container = render(
        makeProps({
          events: [
            makeEvent({
              id: "ue-1",
              source: "user",
              startTime: "2025-01-15T09:00:00Z",
              endTime: "2025-01-15T11:00:00Z",
            }),
          ],
        }),
      );
      expect(container.querySelector('[data-testid="gantt-overview-handle-start-ue-1"]')).toBeNull();
      expect(container.querySelector('[data-testid="gantt-overview-panel"]')).toBeNull();
      expect(container.querySelector('[data-testid="gantt-overview-timebar"]')).toBeNull();
    });

    it("shows a map-style timebar and no edit handles in 全局 mode", () => {
      const rangeStart = new Date(2025, 0, 15);
      const container = render(
        makeProps({
          events: [
            makeEvent({
              id: "ue-1",
              source: "user",
              startTime: new Date(2025, 0, 15, 9).toISOString(),
              endTime: new Date(2025, 0, 15, 11).toISOString(),
            }),
            makeEvent({
              id: "sub-1",
              source: "subscribed:Alice/Work",
              startTime: new Date(2025, 0, 15, 12).toISOString(),
              endTime: new Date(2025, 0, 15, 13).toISOString(),
            }),
          ],
          rangeStart,
          overviewMode: true,
          overviewWindow: { startMs: rangeStart.getTime(), spanMs: 24 * 60 * 60 * 1000 },
          onOverviewWindowChange: vi.fn(),
        }),
      );
      expect(container.querySelector('[data-testid="gantt-overview-panel"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="gantt-overview-axis"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="gantt-overview-timebar"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="gantt-overview-timebar-canvas"]')).not.toBeNull();
      expect(container.querySelector('[data-testid="gantt-overview-zoom-slider"]')).toBeNull();
      expect(container.querySelector('[data-testid="gantt-overview-handle-start-ue-1"]')).toBeNull();
      expect(container.querySelector('[data-testid="gantt-overview-handle-end-ue-1"]')).toBeNull();
      expect(
        container.querySelector('[data-testid="event-bar-ue-1"]')?.getAttribute("data-gantt-editable"),
      ).toBeNull();
    });

    it("renders exactly one continuous bar per visible event", () => {
      const container = render(
        makeProps({
          events: [
            makeEvent({
              id: "evt-span",
              startTime: "2025-01-15T09:00:00Z",
              endTime: "2025-01-15T12:00:00Z",
            }),
          ],
        }),
      );
      const row = container.querySelector('[data-testid="event-row-evt-span"]');
      expect(row).not.toBeNull();
      expect(row!.querySelectorAll('[data-testid^="event-bar-"]')).toHaveLength(1);

      const bar = eventBar(container, "evt-span");
      expect(bar).not.toBeNull();
      expect(bar!.getAttribute("data-status")).toBe("pending");
      expect(bar!.style.backgroundColor).toBe(EVENT_STATUS_COLORS.pending);
      expect(bar!.style.gridColumn).toBe(
        expectedGridColumn(
          "2025-01-15T09:00:00Z",
          "2025-01-15T12:00:00Z",
          "day",
          new Date("2025-01-15T00:00:00Z"),
          24,
        ),
      );
    });

    it("renders point event (null endTime) as one compact bar", () => {
      const container = render(
        makeProps({
          events: [makeEvent({ id: "evt-point", endTime: null })],
        }),
      );
      const bar = eventBar(container, "evt-point");
      expect(bar).not.toBeNull();
      expect(bar!.className).toContain("min-w-[6px]");
      expect(bar!.className).toContain("mx-[16%]");
      expect(bar!.style.gridColumn).toBe(
        expectedGridColumn(
          "2025-01-15T09:00:00Z",
          null,
          "day",
          new Date("2025-01-15T00:00:00Z"),
          24,
        ),
      );
    });

    it("renders one continuous bar for month / quarter / year scales", () => {
      const monthStart = new Date("2025-01-01T00:00:00Z");
      const monthColumns = makeMonthColumns(2025, 0);
      const monthContainer = render(
        makeProps({
          timeScale: "month",
          ganttColumns: monthColumns,
          rangeStart: monthStart,
          events: [
            makeEvent({
              id: "evt-month",
              startTime: "2025-01-10T09:00:00Z",
              endTime: "2025-01-12T09:00:00Z",
            }),
          ],
        }),
      );
      const monthBar = eventBar(monthContainer, "evt-month");
      expect(monthBar).not.toBeNull();
      expect(monthContainer.querySelectorAll('[data-testid^="event-bar-"]')).toHaveLength(1);
      expect(monthBar!.style.gridColumn).toBe(
        expectedGridColumn(
          "2025-01-10T09:00:00Z",
          "2025-01-12T09:00:00Z",
          "month",
          monthStart,
          monthColumns.length,
        ),
      );

      const quarterStart = startOfQuarter(new Date("2025-01-15T00:00:00Z"));
      const quarterColumns = makeQuarterColumns(quarterStart);
      const quarterContainer = render(
        makeProps({
          timeScale: "quarter",
          ganttColumns: quarterColumns,
          rangeStart: quarterStart,
          events: [
            makeEvent({
              id: "evt-quarter",
              startTime: "2025-01-15T09:00:00Z",
              endTime: "2025-01-22T09:00:00Z",
            }),
          ],
        }),
      );
      expect(quarterContainer.querySelectorAll('[data-testid^="event-bar-"]')).toHaveLength(1);
      expect(eventBar(quarterContainer, "evt-quarter")).not.toBeNull();

      const yearStart = startOfYear(new Date("2025-01-15T00:00:00Z"));
      const yearColumns = buildYearGanttColumns(yearStart);
      const yearContainer = render(
        makeProps({
          timeScale: "year",
          ganttColumns: yearColumns,
          rangeStart: yearStart,
          events: [
            makeEvent({
              id: "evt-year",
              startTime: "2025-03-01T00:00:00Z",
              endTime: "2025-05-01T00:00:00Z",
            }),
          ],
        }),
      );
      const yearBar = eventBar(yearContainer, "evt-year");
      expect(yearBar).not.toBeNull();
      expect(yearContainer.querySelectorAll('[data-testid^="event-bar-"]')).toHaveLength(1);
      expect(yearBar!.style.gridColumn).toBe(
        expectedGridColumn(
          "2025-03-01T00:00:00Z",
          "2025-05-01T00:00:00Z",
          "year",
          yearStart,
          yearColumns.length,
        ),
      );
    });

    it("renders one continuous bar on week scale", () => {
      const weekStart = new Date("2025-01-13T00:00:00Z");
      const weekColumns = makeWeekColumns(weekStart);
      const container = render(
        makeProps({
          timeScale: "week",
          ganttColumns: weekColumns,
          rangeStart: weekStart,
          events: [
            makeEvent({
              id: "evt-week",
              startTime: "2025-01-15T09:00:00Z",
              endTime: "2025-01-16T09:00:00Z",
            }),
          ],
        }),
      );
      const bar = eventBar(container, "evt-week");
      expect(bar).not.toBeNull();
      expect(container.querySelectorAll('[data-testid^="event-bar-"]')).toHaveLength(1);
      expect(bar!.style.gridColumn).toBe(
        expectedGridColumn(
          "2025-01-15T09:00:00Z",
          "2025-01-16T09:00:00Z",
          "week",
          weekStart,
          weekColumns.length,
        ),
      );
    });
  });

  describe("state priority", () => {
    it("error state takes priority over loading", () => {
      const container = render(
        makeProps({ error: "Something went wrong", events: [], initialLoading: true }),
      );
      expect(container.textContent).toContain("Something went wrong");
      expect(container.textContent).not.toContain("載入排程事件中");
    });

    it("empty state shows when events are empty and not loading or errored", () => {
      const container = render(
        makeProps({ events: [], initialLoading: false, error: null }),
      );
      expect(container.textContent).toContain("目前沒有排程事件");
      expect(container.textContent).not.toContain("載入排程事件中");
    });
  });

  describe("event bar styling", () => {
    it("EVENT_STATUS_COLORS is defined for all status values (legend)", () => {
      for (const status of ["pending", "confirmed", "completed", "cancelled"] as const) {
        expect(EVENT_STATUS_COLORS[status]).toBeDefined();
      }
    });

    it("rendered continuous bar uses event status color", () => {
      const event = makeEvent({
        id: "evt-status",
        startTime: "2025-01-15T09:00:00Z",
        endTime: "2025-01-15T12:00:00Z",
      });
      const container = render(
        makeProps({
          events: [event],
          eventStatuses: { "evt-status": "confirmed" },
        }),
      );
      const bar = eventBar(container, "evt-status");
      expect(bar).not.toBeNull();
      expect(bar!.getAttribute("data-status")).toBe("confirmed");
      expect(bar!.style.backgroundColor).toBe(EVENT_STATUS_COLORS.confirmed);
      expect(bar!.className).toContain("opacity-92");
    });

    it("empty day cells are hairline tracks, not bordered capsules", () => {
      const container = render(
        makeProps({
          events: [
            makeEvent({
              id: "evt-track",
              startTime: "2025-01-15T09:00:00Z",
              endTime: "2025-01-15T10:00:00Z",
            }),
          ],
        }),
      );
      const cell = container.querySelector(
        '[data-testid="event-cell-evt-track-0"]',
      ) as HTMLElement | null;
      expect(cell).not.toBeNull();
      expect(cell!.className).not.toContain("rounded-sm");
      expect(cell!.className).toContain("border-l");
    });

    it("left label shows status dot and truncates long titles", () => {
      const longTitle = "This is a very long event title that exceeds twenty characters";
      const container = render(
        makeProps({
          events: [makeEvent({ id: "evt-label", title: longTitle })],
          eventStatuses: { "evt-label": "completed" },
        }),
      );
      const statusDot = container.querySelector(
        '[data-testid="gantt-label-status-evt-label"]',
      ) as HTMLElement | null;
      expect(statusDot).not.toBeNull();
      expect(statusDot!.style.backgroundColor).toBe(EVENT_STATUS_COLORS.completed);
      const titleEl = container.querySelector(`[title^="${longTitle}"]`);
      expect(titleEl).not.toBeNull();
      const truncated = Array.from(titleEl!.querySelectorAll("span")).find((el) =>
        el.className.includes("truncate"),
      );
      expect(truncated).toBeDefined();
      expect(truncated!.textContent).toBe(longTitle);
    });
  });

  describe("schedule emojis from entity columns", () => {
    it("shows status dot and title on gantt labels without compact schedule emoji", () => {
      const calEvent = makeEvent({
        id: "cal-task-1:20250115T090000Z",
        seriesId: "cal-task-1",
        title: "Weekly Standup",
        source: "recurring",
        emoji: "🔁",
        startTime: "2025-01-15T09:00:00Z",
        endTime: "2025-01-15T12:00:00Z",
      });
      const container = render(
        makeProps({
          events: [calEvent],
        }),
      );
      expect(container.querySelector('[data-testid="schedule-event-emoji"]')).toBeNull();
      expect(container.querySelector('[data-testid^="gantt-label-status-"]')).toBeTruthy();
      expect(container.textContent).toContain("Weekly Standup");
    });
  });
});

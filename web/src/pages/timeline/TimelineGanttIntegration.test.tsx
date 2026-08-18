import { describe, it, expect, vi } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { makeEvent, makeDayColumns, makeWeekColumns, makeMonthColumns } from "../../test/timelineTestHelpers";
import { TimelinePageProvider, type TimelinePageContextValue } from "./TimelinePageContext";

const { TimelineGanttView } = await import("./gantt/TimelineGanttView");
const { TimelineGrid } = await import("./calendar/TimelineGrid");

type GanttViewProps = Parameters<typeof TimelineGanttView>[0];

function makeGanttProps(overrides: Partial<GanttViewProps> = {}): GanttViewProps {
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

function renderGantt(props: GanttViewProps) {
  const container = document.createElement("div");
  act(() => {
    createRoot(container).render(createElement(TimelineGanttView, props));
  });
  return container;
}

type GridProps = Parameters<typeof TimelineGrid>[0];
type ContextOverrides = Partial<TimelinePageContextValue>;

function makeContextValue(overrides: ContextOverrides = {}): TimelinePageContextValue {
  return {
    selectedEvent: null,
    onSelectEvent: vi.fn(),
    editStartTime: "",
    editEndTime: "",
    setEditStartTime: vi.fn(),
    setEditEndTime: vi.fn(),
    onSaveTimeOverride: vi.fn(),
    onResetTimeOverride: vi.fn(),
    onSetEventStatus: vi.fn(),
    eventStatuses: {},
    taskSpans: [],
    selectedGanttTaskId: "task-1",
    onSelectGanttTask: vi.fn(),
    spansInitialLoading: false,
    spansIsRefreshing: false,
    spansError: null,
    onRetrySpans: vi.fn(),
    selectedGanttSpan: null,
    onCloseGanttPanel: vi.fn(),
    ganttColumns: makeDayColumns(),
    timelineEvents: [makeEvent()],
    timelineEventsInitialLoading: false,
    timelineEventsIsRefreshing: false,
    timelineEventsError: null,
    onRetryTimelineEvents: vi.fn(),
    showDismissed: false,
    showOngoing: true,
    showEnding: true,
    monthDatesRevealed: false,
    ...overrides,
  };
}

function makeGridProps(overrides: Partial<GridProps> = {}): GridProps {
  const rangeStart = new Date("2025-01-15T00:00:00Z");
  return {
    viewMode: "gantt",
    timeScale: "day",
    rangeStart,
    rangeEvents: [],
    weekDays: [],
    timeCursor: rangeStart,
    monthCursor: rangeStart,
    monthDays: [],
    monthEvents: [],
    focusedDay: null,
    eventStatuses: {},
    onSelectEvent: vi.fn(),
    onFocusDay: vi.fn(),
    ...overrides,
  };
}

async function renderGrid(props: GridProps, ctxOverrides: ContextOverrides = {}) {
  const container = document.createElement("div");
  const ctx = makeContextValue(ctxOverrides);
  await act(async () => {
    createRoot(container).render(
      createElement(TimelinePageProvider, { value: ctx, children: createElement(TimelineGrid, props) }),
    );
    await Promise.resolve();
    await Promise.resolve();
  });
  return container;
}

/* ------------------------------------------------------------------ */
/*  Integration Tests: Data Flow                                       */
/* ------------------------------------------------------------------ */

describe("TimelineGantt Integration: Data Flow", () => {
  describe("Selecting a task triggers correct rendering (Requirement 1.1)", () => {
    it("renders events for task-1 when timelineEvents contains task-1 events", async () => {
      const task1Events = [
        makeEvent({ id: "evt-1", taskId: "task-1", title: "Task 1 Meeting" }),
        makeEvent({ id: "evt-2", taskId: "task-1", title: "Task 1 Review", startTime: "2025-01-15T14:00:00Z", endTime: "2025-01-15T15:00:00Z" }),
      ];

      const container = await renderGrid(
        makeGridProps(),
        {
          timelineEvents: task1Events,
          selectedGanttTaskId: "task-1",
        },
      );

      expect(container.textContent).toContain("Task 1 Meeting");
      expect(container.textContent).toContain("Task 1 Review");
      const rows = container.querySelectorAll('[data-testid^="event-row-"]');
      expect(rows.length).toBe(2);
    });

    it("renders events for task-2 when timelineEvents is updated with task-2 events", async () => {
      const task2Events = [
        makeEvent({ id: "evt-3", taskId: "task-2", title: "Task 2 Standup" }),
        makeEvent({ id: "evt-4", taskId: "task-2", title: "Task 2 Deploy", startTime: "2025-01-15T16:00:00Z", endTime: "2025-01-15T17:00:00Z" }),
        makeEvent({ id: "evt-5", taskId: "task-2", title: "Task 2 Retro", startTime: "2025-01-15T18:00:00Z", endTime: "2025-01-15T19:00:00Z" }),
      ];

      const container = await renderGrid(
        makeGridProps(),
        {
          timelineEvents: task2Events,
          selectedGanttTaskId: "task-2",
        },
      );

      expect(container.textContent).toContain("Task 2 Standup");
      expect(container.textContent).toContain("Task 2 Deploy");
      expect(container.textContent).toContain("Task 2 Retro");
      // Should NOT contain task-1 events
      expect(container.textContent).not.toContain("Task 1 Meeting");
      const rows = container.querySelectorAll('[data-testid^="event-row-"]');
      expect(rows.length).toBe(3);
    });
  });

  describe("Switching tasks clears old events and loads new ones (Requirement 1.2)", () => {
    it("renders new events after task switch completes", async () => {
      // First render: task-1 events
      const container1 = await renderGrid(
        makeGridProps(),
        {
          timelineEvents: [
            makeEvent({ id: "evt-1", taskId: "task-1", title: "Old Event A" }),
          ],
          selectedGanttTaskId: "task-1",
        },
      );
      expect(container1.textContent).toContain("Old Event A");

      // Second render: task-2 events (simulating completed switch)
      const container2 = await renderGrid(
        makeGridProps(),
        {
          timelineEvents: [
            makeEvent({ id: "evt-3", taskId: "task-2", title: "New Event B" }),
            makeEvent({ id: "evt-4", taskId: "task-2", title: "New Event C", startTime: "2025-01-15T14:00:00Z", endTime: "2025-01-15T15:00:00Z" }),
          ],
          selectedGanttTaskId: "task-2",
        },
      );
      expect(container2.textContent).toContain("New Event B");
      expect(container2.textContent).toContain("New Event C");
      expect(container2.textContent).not.toContain("Old Event A");
    });
  });

  describe("Navigation moves cursor correctly (Requirements 6.1, 6.2)", () => {
    it("moving rangeStart forward hides events that are no longer in range", () => {
      const event = makeEvent({
        startTime: "2025-01-15T09:00:00Z",
        endTime: "2025-01-15T11:00:00Z",
      });

      const container1 = renderGantt(
        makeGanttProps({
          timeScale: "day",
          ganttColumns: makeDayColumns(),
          rangeStart: new Date("2025-01-15T00:00:00Z"),
          events: [event],
        }),
      );
      const rows1 = container1.querySelectorAll('[data-testid^="event-row-"]');
      expect(rows1.length).toBe(1);

      const container2 = renderGantt(
        makeGanttProps({
          timeScale: "day",
          ganttColumns: makeDayColumns(),
          rangeStart: new Date("2025-01-16T00:00:00Z"),
          events: [event],
        }),
      );
      const rows2 = container2.querySelectorAll('[data-testid^="event-row-"]');
      expect(rows2.length).toBe(0);
    });

    it("moving rangeStart backward reveals events that come into range", () => {
      const event = makeEvent({
        startTime: "2025-01-14T09:00:00Z",
        endTime: "2025-01-14T11:00:00Z",
      });

      const container1 = renderGantt(
        makeGanttProps({
          timeScale: "day",
          ganttColumns: makeDayColumns(),
          rangeStart: new Date("2025-01-15T00:00:00Z"),
          events: [event],
        }),
      );
      const rows1 = container1.querySelectorAll('[data-testid^="event-row-"]');
      expect(rows1.length).toBe(0);

      const container2 = renderGantt(
        makeGanttProps({
          timeScale: "day",
          ganttColumns: makeDayColumns(),
          rangeStart: new Date("2025-01-14T00:00:00Z"),
          events: [event],
        }),
      );
      const rows2 = container2.querySelectorAll('[data-testid^="event-row-"]');
      expect(rows2.length).toBe(1);
    });

    it("week navigation: moving forward by one week changes visible events", () => {
      const event = makeEvent({
        startTime: "2025-01-15T09:00:00Z",
        endTime: "2025-01-15T17:00:00Z",
      });

      const weekStart1 = new Date("2025-01-13T00:00:00Z");
      const container1 = renderGantt(
        makeGanttProps({
          timeScale: "week",
          ganttColumns: makeWeekColumns(weekStart1),
          rangeStart: weekStart1,
          events: [event],
        }),
      );
      const rows1 = container1.querySelectorAll('[data-testid^="event-row-"]');
      expect(rows1.length).toBe(1);

      const weekStart2 = new Date("2025-01-20T00:00:00Z");
      const container2 = renderGantt(
        makeGanttProps({
          timeScale: "week",
          ganttColumns: makeWeekColumns(weekStart2),
          rangeStart: weekStart2,
          events: [event],
        }),
      );
      const rows2 = container2.querySelectorAll('[data-testid^="event-row-"]');
      expect(rows2.length).toBe(0);
    });

    it("month navigation: moving to next month hides current month events", () => {
      const event = makeEvent({
        startTime: "2025-01-15T09:00:00Z",
        endTime: "2025-01-15T17:00:00Z",
      });

      const janStart = new Date("2025-01-01T00:00:00Z");
      const container1 = renderGantt(
        makeGanttProps({
          timeScale: "month",
          ganttColumns: makeMonthColumns(2025, 0),
          rangeStart: janStart,
          events: [event],
        }),
      );
      const rows1 = container1.querySelectorAll('[data-testid^="event-row-"]');
      expect(rows1.length).toBe(1);

      const febStart = new Date("2025-02-01T00:00:00Z");
      const container2 = renderGantt(
        makeGanttProps({
          timeScale: "month",
          ganttColumns: makeMonthColumns(2025, 1),
          rangeStart: febStart,
          events: [event],
        }),
      );
      const rows2 = container2.querySelectorAll('[data-testid^="event-row-"]');
      expect(rows2.length).toBe(0);
    });
  });

  describe("End-to-end data flow through TimelineGrid", () => {
    it("TimelineGrid passes timelineEvents to TimelineGanttView correctly", async () => {
      const events = [
        makeEvent({ id: "evt-1", title: "Alpha" }),
        makeEvent({ id: "evt-2", title: "Beta", startTime: "2025-01-15T14:00:00Z", endTime: "2025-01-15T16:00:00Z" }),
      ];

      const container = await renderGrid(
        makeGridProps({ viewMode: "gantt" }),
        {
          timelineEvents: events,
          selectedGanttTaskId: "task-1",
        },
      );

      expect(container.textContent).toContain("Alpha");
      expect(container.textContent).toContain("Beta");
      const rows = container.querySelectorAll('[data-testid^="event-row-"]');
      expect(rows.length).toBe(2);
    });

    it("TimelineGrid renders calendar view when viewMode is calendar (not gantt)", async () => {
      const container = await renderGrid(
        makeGridProps({
          viewMode: "calendar",
          rangeEvents: [makeEvent({ title: "Calendar Event" })],
        }),
      );

      expect(container.textContent).toContain("Calendar Event");
      expect(container.textContent).not.toContain("事件");
    });
  });
});

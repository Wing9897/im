import { describe, it, expect, vi } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { makeEvent, makeDayColumns } from "../../../test/timelineTestHelpers";
import { TimelinePageProvider, type TimelinePageContextValue } from "../TimelinePageContext";

vi.mock("../../../domain/timeline/useEventListMetaLookups", () => ({
  useEventListMetaLookups: () => ({
    generalWorksetLabel: "General",
    worksetNameById: new Map<string, string>(),
    taskWorksetById: new Map<string, string>(),
    subscribeOwnerAvatarByHandle: new Map<string, string>(),
    subscribeDescriptionByKey: new Map<string, string>(),
  }),
}));

vi.mock("../gantt/TimelineGanttView", () => ({
  TimelineGanttView: ({
    events,
  }: {
    events: Array<{ title: string }>;
  }) => {
    if (events.length === 0) {
      return createElement("div", null, "目前沒有排程事件");
    }
    return createElement(
      "div",
      null,
      "事件",
      ...events.map((event) => createElement("span", { key: event.title }, event.title)),
    );
  },
}));

const { TimelineGrid } = await import("./TimelineGrid");

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
    selectedGanttTaskId: null,
    onSelectGanttTask: vi.fn(),
    spansInitialLoading: false,
    spansIsRefreshing: false,
    spansError: null,
    onRetrySpans: vi.fn(),
    selectedGanttSpan: null,
    onCloseGanttPanel: vi.fn(),
    ganttColumns: makeDayColumns(),
    timelineEvents: [],
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

function makeProps(overrides: Partial<GridProps> = {}): GridProps {
  const rangeStart = new Date("2025-01-15T00:00:00Z");
  return {
    viewMode: "calendar",
    timeScale: "day",
    rangeStart,
    rangeEvents: [makeEvent()],
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

function render(props: GridProps, ctxOverrides: ContextOverrides = {}) {
  const container = document.createElement("div");
  const ctx = makeContextValue(ctxOverrides);
  act(() => {
    createRoot(container).render(
      createElement(TimelinePageProvider, { value: ctx, children: createElement(TimelineGrid, props) }),
    );
  });
  return container;
}

/**
 * Async render that waits for lazy-loaded components to resolve.
 */
async function renderAsync(props: GridProps, ctxOverrides: ContextOverrides = {}) {
  const container = document.createElement("div");
  const ctx = makeContextValue(ctxOverrides);
  await act(async () => {
    createRoot(container).render(
      createElement(TimelinePageProvider, { value: ctx, children: createElement(TimelineGrid, props) }),
    );
  });
  // Poll: each macro-tick lets the lazy import + Suspense commit progress.
  for (let i = 0; i < 10; i++) {
    if (container.textContent && container.textContent.length > 0) break;
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });
  }
  return container;
}

describe("TimelineGrid viewMode branch", () => {
  it("renders the calendar view when viewMode is 'calendar'", () => {
    const container = render(makeProps({ viewMode: "calendar" }));
    expect(container.textContent).toContain("Kickoff");
    expect(container.textContent).toContain("Kickoff meeting");
    expect(container.textContent).not.toContain("任務");
  });

  it("renders the gantt view when viewMode is 'gantt'", async () => {
    const container = await renderAsync(
      makeProps({ viewMode: "gantt" }),
      {
        timelineEvents: [makeEvent({ title: "Meeting task" })],
      },
    );
    expect(container.textContent).toContain("事件");
    expect(container.textContent).toContain("Meeting task");
  });

  it("gantt branch renders TimelineGanttView with schedule events data", async () => {
    const container = await renderAsync(
      makeProps({ viewMode: "gantt" }),
      {
        timelineEvents: [
          makeEvent({ id: "evt-a", title: "Alpha Event" }),
          makeEvent({ id: "evt-b", title: "Beta Event", startTime: "2025-01-15T12:00:00Z", endTime: "2025-01-15T14:00:00Z" }),
        ],
        selectedGanttTaskId: "task-a",
      },
    );
    expect(container.textContent).toContain("Alpha Event");
    expect(container.textContent).toContain("Beta Event");
  });

  it("reads month-cards from context instead of props", () => {
    const container = render(makeProps({ viewMode: "calendar", timeScale: "month" }), {
      monthLayout: "split",
      monthCardModels: [
        { kind: "workset", worksetId: "ws-a", title: "Alpha", events: [] },
      ],
    });
    expect(container.querySelector('[data-testid="timeline-month-cards-grid"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="timeline-month-card"]')).not.toBeNull();
  });

  it("calendar branch renders TimelineCalendarView with event data unchanged", () => {
    const onSelectEvent = vi.fn();
    const container = render(
      makeProps({
        viewMode: "calendar",
        rangeEvents: [
          makeEvent({ id: "evt-1", title: "Morning Standup", body: "Daily sync" }),
          makeEvent({ id: "evt-2", title: "Lunch Break", body: "Noon break", startTime: "2025-01-15T12:00:00Z", endTime: "2025-01-15T13:00:00Z" }),
        ],
        onSelectEvent,
      }),
    );
    expect(container.textContent).toContain("Morning Standup");
    expect(container.textContent).toContain("Lunch Break");
    expect(container.textContent).not.toContain("任務");
  });

  it("gantt branch shows empty state when there are no timeline events", async () => {
    const container = await renderAsync(
      makeProps({ viewMode: "gantt" }),
      { timelineEvents: [] },
    );
    expect(container.textContent).toContain("目前沒有排程事件");
  });
});

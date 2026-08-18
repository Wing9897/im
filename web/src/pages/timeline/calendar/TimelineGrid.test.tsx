import { describe, it, expect, vi } from "vitest";
import { createElement, act } from "react";
import { createRoot } from "react-dom/client";
import { makeEvent, makeDayColumns } from "../../../test/timelineTestHelpers";
import { buildCalendarDays } from "../../../domain/timeline/dateUtils";
import { ensureZhHantLocale, wrapWithI18n } from "../../../test/i18nHarness";
import { TimelinePageProvider, type TimelinePageContextValue } from "../TimelinePageContext";
import { TimelineControlBar } from "../components/TimelineControlBar";
import { TimelineShowOptionsControl } from "../components/TimelineShowOptionsControl";
import { fireMonthRevealPointer } from "./timelineCalendarViewTestHarness";
import { useMonthDateReveal } from "./useMonthDateReveal";

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

/* ------------------------------------------------------------------ */
/*  TimelineGrid — viewMode conditional branch                         */
/* ------------------------------------------------------------------ */

describe("TimelineGrid viewMode branch", () => {
  it("renders the calendar view when viewMode is 'calendar'", () => {
    const container = render(makeProps({ viewMode: "calendar" }));
    // Calendar day view includes the event summary text and title.
    expect(container.textContent).toContain("Kickoff");
    expect(container.textContent).toContain("Kickoff meeting");
    // Gantt view renders a 任務 column header. It should NOT be present in calendar view.
    expect(container.textContent).not.toContain("任務");
  });

  it("renders the gantt view when viewMode is 'gantt'", async () => {
    const container = await renderAsync(
      makeProps({ viewMode: "gantt" }),
      {
        timelineEvents: [makeEvent({ title: "Meeting task" })],
      },
    );
    // Gantt view shows the 事件 header and the event title.
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
    // Both event titles should be rendered
    expect(container.textContent).toContain("Alpha Event");
    expect(container.textContent).toContain("Beta Event");
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
    // Calendar view renders event titles
    expect(container.textContent).toContain("Morning Standup");
    expect(container.textContent).toContain("Lunch Break");
    // Should not contain gantt-specific content
    expect(container.textContent).not.toContain("任務");
  });

  it("gantt branch shows empty state when there are no timeline events", async () => {
    const container = await renderAsync(
      makeProps({ viewMode: "gantt" }),
      { timelineEvents: [] },
    );
    expect(container.textContent).toContain("目前沒有排程事件");
  });

  it("month cells layer a watermark date and honor monthDatesRevealed from context", async () => {
    await ensureZhHantLocale();
    const monthCursor = new Date(2025, 0, 1);
    const monthDays = buildCalendarDays(monthCursor);
    const container = document.createElement("div");
    const ctx = makeContextValue({ monthDatesRevealed: true });
    act(() => {
      createRoot(container).render(
        wrapWithI18n(
          createElement(TimelinePageProvider, {
            value: ctx,
            children: createElement(
              TimelineGrid,
              makeProps({
                viewMode: "calendar",
                timeScale: "month",
                monthCursor,
                monthDays,
                monthEvents: [
                  makeEvent({
                    id: "evt-month",
                    title: "月事件",
                    startTime: "2025-01-15T09:00:00",
                  }),
                ],
                timeCursor: new Date(2025, 0, 10),
              }),
            ),
          }),
        ),
      );
    });

    expect(container.querySelectorAll('[data-testid="timeline-month-day-cell"]')).toHaveLength(42);
    const grid = container.querySelector('[data-testid="timeline-month-grid"]');
    expect(grid?.className).toContain("im-timeline-month-grid");
    expect(grid?.className).toContain("is-revealed");
    expect(grid?.getAttribute("data-dates-revealed")).toBe("true");
    expect(container.querySelectorAll('[data-testid="timeline-month-day-header"]')).toHaveLength(42);
  });

  it("toolbar 篩選 eye hover previews dates; 顯示日期 checkbox persists", async () => {
    await ensureZhHantLocale();
    const monthCursor = new Date(2025, 0, 1);
    const monthDays = buildCalendarDays(monthCursor);

    function ToolbarToGridHarness() {
      const reveal = useMonthDateReveal();
      const ctx = makeContextValue({ monthDatesRevealed: reveal.revealed });
      return createElement(TimelinePageProvider, {
        value: ctx,
        children: createElement(
          "div",
          null,
          createElement(
            TimelineControlBar,
            {
              selectedSources: null,
              setSelectedSources: () => {},
              timelineTasks: [],
              viewMode: "calendar",
              setViewMode: () => {},
              timeScale: "month",
              onJumpTo: () => {},
              onMoveCursor: () => {},
              visibleRangeLabel: "2025年1月",
            },
            createElement(TimelineShowOptionsControl, {
              showDismissed: true,
              setShowDismissed: () => {},
              showOngoing: true,
              setShowOngoing: () => {},
              showEnding: true,
              setShowEnding: () => {},
              monthDateReveal: {
                persisted: reveal.persisted,
                onPersistedChange: reveal.onPersistedChange,
                onPointerEnter: reveal.onPointerEnter,
                onPointerLeave: reveal.onPointerLeave,
              },
            }),
          ),
          createElement(
            TimelineGrid,
            makeProps({
              viewMode: "calendar",
              timeScale: "month",
              monthCursor,
              monthDays,
              monthEvents: [
                makeEvent({
                  id: "evt-month",
                  title: "月事件",
                  startTime: "2025-01-15T09:00:00",
                }),
              ],
              timeCursor: new Date(2025, 0, 10),
            }),
          ),
        ),
      });
    }

    const container = document.createElement("div");
    document.body.appendChild(container);
    act(() => {
      createRoot(container).render(wrapWithI18n(createElement(ToolbarToGridHarness)));
    });

    const bar = container.querySelector('[data-testid="timeline-control-bar"]');
    const reveal = bar?.querySelector<HTMLButtonElement>('[data-testid="timeline-show-options"]');
    expect(reveal).toBeTruthy();
    expect(reveal?.textContent).not.toContain("顯示");
    expect(reveal?.getAttribute("aria-label")).toBe("篩選");
    expect(container.querySelectorAll('[data-testid="timeline-show-options"]')).toHaveLength(1);
    const grid = () => container.querySelector('[data-testid="timeline-month-grid"]');
    expect(grid()?.className).toContain("im-timeline-month-grid");
    expect(grid()?.className).not.toContain("is-revealed");
    expect(grid()?.getAttribute("data-dates-revealed")).toBe("false");

    fireMonthRevealPointer(reveal!, "enter");
    expect(grid()?.className).toContain("is-revealed");
    expect(grid()?.getAttribute("data-dates-revealed")).toBe("true");

    fireMonthRevealPointer(reveal!, "leave");
    expect(grid()?.className).not.toContain("is-revealed");
    expect(grid()?.getAttribute("data-dates-revealed")).toBe("false");

    act(() => {
      reveal!.click();
    });
    expect(reveal!.getAttribute("data-dates-persisted")).toBe("false");
    expect(grid()?.className).not.toContain("is-revealed");
    expect(document.querySelector('[data-testid="timeline-show-options-menu"]')).toBeTruthy();
    expect(document.querySelector('[data-testid="timeline-show-options-menu"]')?.textContent).toContain(
      "顯示日期",
    );

    const dates = document.querySelector(
      '[data-testid="timeline-show-options-dates"]',
    ) as HTMLInputElement;
    expect(dates).toBeTruthy();
    expect(dates.checked).toBe(false);
    act(() => {
      dates.click();
    });
    expect(reveal!.getAttribute("data-dates-persisted")).toBe("true");
    expect(grid()?.className).toContain("is-revealed");
    expect(grid()?.getAttribute("data-dates-revealed")).toBe("true");

    fireMonthRevealPointer(reveal!, "enter");
    fireMonthRevealPointer(reveal!, "leave");
    expect(reveal!.getAttribute("data-dates-persisted")).toBe("true");
    expect(grid()?.className).toContain("is-revealed");
    expect(grid()?.getAttribute("data-dates-revealed")).toBe("true");

    container.remove();
    document
      .querySelectorAll('[data-testid="timeline-show-options-menu"]')
      .forEach((node) => node.remove());
  });
});

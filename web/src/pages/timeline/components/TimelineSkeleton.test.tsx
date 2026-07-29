import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { I18nextProvider } from "react-i18next";

import i18n from "../../../i18n";
import { setAppLocale } from "../../../i18n/locale";
import { TimelineSkeleton } from "./TimelineSkeleton";
import { TimelineViewSwitch } from "./TimelineViewSwitch";
import { TimelinePageProvider, type TimelinePageContextValue } from "../TimelinePageContext";
import { buildCalendarDays, buildWeekDays } from "../../../domain/timeline/dateUtils";
import { mockShowToast } from "../../../test/context-mocks";

vi.mock("../../../context/ToastContext", async () =>
  (await import("../../../test/context-mocks")).toastContextModuleMock());

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function render(viewMode: "calendar" | "gantt") {
  const container = document.createElement("div");
  act(() => {
    createRoot(container).render(createElement(TimelineSkeleton, { viewMode }));
  });
  return container;
}

function withI18n(children: React.ReactNode) {
  return createElement(I18nextProvider, { i18n }, children);
}

function makeContextValue(): TimelinePageContextValue {
  return {
    selectedEvent: null,
    onSelectEvent: () => {},
    editStartTime: "",
    editEndTime: "",
    setEditStartTime: () => {},
    setEditEndTime: () => {},
    onSaveTimeOverride: () => {},
    onResetTimeOverride: () => {},
    onSetEventStatus: () => {},
    eventStatuses: {},
    taskSpans: [],
    selectedGanttTaskId: null,
    onSelectGanttTask: () => {},
    spansInitialLoading: false,
    spansIsRefreshing: false,
    spansError: null,
    onRetrySpans: () => {},
    selectedGanttSpan: null,
    onCloseGanttPanel: () => {},
    ganttColumns: [],
    timelineEvents: [],
    timelineEventsInitialLoading: false,
    timelineEventsIsRefreshing: false,
    timelineEventsError: null,
    onRetryTimelineEvents: () => {},
    showDismissed: false,
    showOngoing: true,
    showEnding: true,
  };
}

/** Minimal props for TimelineViewSwitch to render in loading/error states */
function makeViewSwitchProps(overrides: Partial<Parameters<typeof TimelineViewSwitch>[0]> = {}) {
  const now = new Date(2026, 6, 15);
  return {
    initialLoading: false,
    isRefreshing: false,
    events: [],
    filteredEvents: [],
    emptyState: "沒有事件",
    viewMode: "calendar" as const,
    timeScale: "month" as const,
    rangeStart: now,
    rangeEvents: [],
    sidebarEvents: [],
    weekDays: buildWeekDays(now),
    timeCursor: now,
    monthCursor: now,
    monthDays: buildCalendarDays(now),
    monthEvents: [],
    onFocusDay: () => {},
    error: null,
    onRetry: () => {},
    ...overrides,
  };
}

function renderViewSwitch(overrides: Partial<Parameters<typeof TimelineViewSwitch>[0]> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const props = makeViewSwitchProps(overrides);
  const ctx = makeContextValue();
  let root: Root;
  act(() => {
    root = createRoot(container);
    root.render(
      withI18n(
        createElement(TimelinePageProvider, {
          value: ctx,
          children: createElement(TimelineViewSwitch, props),
        }),
      ),
    );
  });
  return { container, root: root!, rerender: (newOverrides: Partial<Parameters<typeof TimelineViewSwitch>[0]>) => {
    const newProps = makeViewSwitchProps(newOverrides);
    act(() => {
      root.render(
        withI18n(
          createElement(TimelinePageProvider, {
            value: ctx,
            children: createElement(TimelineViewSwitch, newProps),
          }),
        ),
      );
    });
  }};
}

/* ------------------------------------------------------------------ */
/*  TimelineSkeleton (isolated component tests)                        */
/* ------------------------------------------------------------------ */

describe("TimelineSkeleton", () => {
  it("renders with data-testid for calendar mode", () => {
    const container = render("calendar");
    const skeleton = container.querySelector('[data-testid="timeline-skeleton"]');
    expect(skeleton).not.toBeNull();
  });

  it("renders with data-testid for gantt mode", () => {
    const container = render("gantt");
    const skeleton = container.querySelector('[data-testid="timeline-skeleton"]');
    expect(skeleton).not.toBeNull();
  });

  it("applies im-shimmer class to placeholder blocks", () => {
    const container = render("calendar");
    const shimmerBlocks = container.querySelectorAll(".im-shimmer");
    expect(shimmerBlocks.length).toBeGreaterThan(0);
  });

  it("calendar mode renders 7 column headers", () => {
    const container = render("calendar");
    const skeleton = container.querySelector('[data-testid="timeline-skeleton"]');
    const headerGrid = skeleton!.querySelector(".grid-cols-7");
    expect(headerGrid).not.toBeNull();
    expect(headerGrid!.children.length).toBe(7);
  });

  it("calendar mode renders 7 day cells", () => {
    const container = render("calendar");
    const skeleton = container.querySelector('[data-testid="timeline-skeleton"]');
    const dayCells = skeleton!.querySelectorAll('[class*="min-h-[160px]"]');
    expect(dayCells.length).toBe(7);
  });

  it("gantt mode renders time axis header and event rows", () => {
    const container = render("gantt");
    const skeleton = container.querySelector('[data-testid="timeline-skeleton"]');
    // Gantt has a grid with 148px label column
    const grids = skeleton!.querySelectorAll(
      'div[style*="148px"]'
    );
    // Header row + 6 event rows = 7 grids with 148px column
    expect(grids.length).toBe(7);
  });

  it("gantt mode has minimum width of 700px", () => {
    const container = render("gantt");
    const skeleton = container.querySelector('[data-testid="timeline-skeleton"]');
    const minWidthEl = skeleton!.querySelector('[class*="min-w-[700px]"]');
    expect(minWidthEl).not.toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  TimelineViewSwitch — skeleton loading integration                  */
/* ------------------------------------------------------------------ */

describe("TimelineViewSwitch skeleton loading integration", () => {
  beforeEach(async () => {
    setAppLocale("zh-Hant");
    await i18n.changeLanguage("zh-Hant");
    vi.useFakeTimers();
    mockShowToast.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("renders TimelineSkeleton when initialLoading is true and events are empty", () => {
    const { container } = renderViewSwitch({ initialLoading: true, events: [] });
    const skeleton = container.querySelector('[data-testid="timeline-skeleton"]');
    expect(skeleton).not.toBeNull();
  });

  it("renders skeleton with correct viewMode (calendar)", () => {
    const { container } = renderViewSwitch({
      initialLoading: true,
      events: [],
      viewMode: "calendar",
    });
    const skeleton = container.querySelector('[data-testid="timeline-skeleton"]');
    expect(skeleton).not.toBeNull();
    const headerGrid = skeleton!.querySelector(".grid-cols-7");
    expect(headerGrid).not.toBeNull();
  });

  it("renders skeleton with correct viewMode (gantt)", () => {
    const { container } = renderViewSwitch({
      initialLoading: true,
      events: [],
      viewMode: "gantt",
    });
    const skeleton = container.querySelector('[data-testid="timeline-skeleton"]');
    expect(skeleton).not.toBeNull();
    // Gantt skeleton has 148px label column
    const ganttGrids = skeleton!.querySelectorAll('div[style*="148px"]');
    expect(ganttGrids.length).toBeGreaterThan(0);
  });

  it("shows a timeout toast while preserving the calendar layout", () => {
    const { container } = renderViewSwitch({
      initialLoading: true,
      events: [],
    });

    // Initially shows skeleton
    expect(container.querySelector('[data-testid="timeline-skeleton"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="timeline-error-state"]')).toBeNull();

    // Advance time past the 30s timeout
    act(() => {
      vi.advanceTimersByTime(30_000);
    });

    expect(mockShowToast).toHaveBeenCalledWith(i18n.t("timeline:view.loadTimeout"), "error");
    expect(container.querySelector('[data-testid="timeline-main-layout"]')).not.toBeNull();
  });

  it("does not show error state if data arrives before timeout", () => {
    const { container, rerender } = renderViewSwitch({
      initialLoading: true,
      events: [],
    });

    // Initially shows skeleton
    expect(container.querySelector('[data-testid="timeline-skeleton"]')).not.toBeNull();

    // Advance time partially (15s — before timeout)
    act(() => {
      vi.advanceTimersByTime(15_000);
    });

    // Still shows skeleton (no error yet)
    expect(container.querySelector('[data-testid="timeline-skeleton"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="timeline-error-state"]')).toBeNull();

    // Data arrives — loading completes
    rerender({ initialLoading: false, events: [{ id: "1" } as any], filteredEvents: [{ id: "1" } as any] });

    // No skeleton, no error
    expect(container.querySelector('[data-testid="timeline-skeleton"]')).toBeNull();
    expect(container.querySelector('[data-testid="timeline-error-state"]')).toBeNull();
  });

  it("shows an error toast with calendar layout when error prop is provided", () => {
    const { container } = renderViewSwitch({
      initialLoading: false,
      events: [],
      error: "網路連線失敗",
    });

    expect(mockShowToast).toHaveBeenCalledWith("網路連線失敗", "error");
    expect(container.querySelector('[data-testid="timeline-main-layout"]')).not.toBeNull();
  });

  it("keeps month calendar grid visible when there are no events", () => {
    const { container } = renderViewSwitch({
      events: [],
      filteredEvents: [],
      timeScale: "month",
    });

    expect(container.querySelector('[data-testid="timeline-main-layout"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="timeline-empty-hint"]')).toBeNull();
    expect(container.textContent).toContain("一");
    expect(container.textContent).toContain("日");
  });

  it("shows filter hint but keeps grid when all events are filtered out", () => {
    const sampleEvent = {
      id: "evt-1",
      title: "Sample",
      startTime: "2026-07-15T03:00:00.000Z",
      endTime: "2026-07-15T04:00:00.000Z",
    } as const;

    const { container } = renderViewSwitch({
      events: [sampleEvent as any],
      filteredEvents: [],
      rangeEvents: [],
    });

    expect(container.querySelector('[data-testid="timeline-main-layout"]')).not.toBeNull();
    expect(container.textContent).toContain(i18n.t("timeline:empty.filteredTitle"));
  });

  it("keeps grid visible and shows refresh indicator while refreshing with cached events", () => {
    const sampleEvent = {
      id: "evt-1",
      title: "Sample",
      startTime: "2026-04-17T03:00:00.000Z",
      endTime: "2026-04-17T04:00:00.000Z",
    } as const;

    const { container } = renderViewSwitch({
      initialLoading: false,
      isRefreshing: true,
      events: [sampleEvent as any],
      filteredEvents: [sampleEvent as any],
    });

    expect(container.querySelector('[data-testid="timeline-skeleton"]')).toBeNull();
    expect(container.querySelector('[data-testid="timeline-refresh-indicator"]')).not.toBeNull();
  });
});

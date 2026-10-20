import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createElement, act } from "react";
import { createRoot, type Root } from "react-dom/client";

import { TimelineSkeleton } from "./TimelineSkeleton";
import { TimelineViewSwitch } from "./TimelineViewSwitch";
import { TimelinePageProvider } from "../TimelinePageContext";
import { buildCalendarDays, buildWeekDays, type TimelineScale } from "../../../domain/timeline/dateUtils";
import { mockShowToast } from "../../../test/context-mocks";
import { ensureZhHantLocale, i18n, wrapWithI18n } from "../../../test/i18nHarness";
import {
  makeTimelinePageContext,
  type TimelinePageContextOverrides,
} from "../../../test/timelinePageContextFixtures";
import type { TimelineItem } from "../../../types";

vi.mock("../../../context/ToastContext", async () =>
  (await import("../../../test/context-mocks")).toastContextModuleMock());

vi.mock("../../../context/TaskCatalogContext", async () =>
  (await import("../../../test/context-mocks")).taskCatalogModuleMock());

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

type Mount = { container: HTMLDivElement; root: Root };

function unmountAll(mounts: Mount[]) {
  for (const { container, root } of mounts.splice(0)) {
    act(() => {
      root.unmount();
    });
    container.remove();
  }
}

function withI18n(children: React.ReactNode) {
  return wrapWithI18n(children);
}

type ViewSwitchInput = {
  initialLoading?: boolean;
  isRefreshing?: boolean;
  events?: TimelineItem[];
  filteredEvents?: TimelineItem[];
  emptyState?: string;
  viewMode?: "calendar" | "gantt";
  timeScale?: TimelineScale;
  rangeStart?: Date;
  rangeEvents?: TimelineItem[];
  sidebarEvents?: TimelineItem[];
  weekDays?: Date[];
  timeCursor?: Date;
  monthCursor?: Date;
  monthDays?: Date[];
  monthEvents?: TimelineItem[];
  focusedDay?: Date | null;
  onFocusDay?: (day: Date) => void;
  error?: string | null;
  sidebarDay?: Date | null;
  sidebarOutOfView?: boolean;
};

/** Minimal view data for TimelineViewSwitch loading/error states. */
function makeViewSwitchProps(overrides: ViewSwitchInput = {}): ViewSwitchInput {
  const now = new Date(2026, 6, 15);
  return {
    initialLoading: false,
    isRefreshing: false,
    events: [],
    filteredEvents: [],
    emptyState: "沒有事件",
    viewMode: "calendar",
    timeScale: "month",
    rangeStart: now,
    rangeEvents: [],
    sidebarEvents: [],
    weekDays: buildWeekDays(now),
    timeCursor: now,
    monthCursor: now,
    monthDays: buildCalendarDays(now),
    monthEvents: [],
    focusedDay: null,
    onFocusDay: () => {},
    error: null,
    ...overrides,
  };
}

function viewSwitchContext(
  props: ViewSwitchInput,
  contextOverrides: TimelinePageContextOverrides = {},
) {
  return makeTimelinePageContext({
    showDismissed: false,
    monthLayout: "unified",
    ...contextOverrides,
    navigation: {
      timeScale: props.timeScale ?? "month",
      rangeStart: props.rangeStart ?? new Date(2026, 6, 15),
      rangeEvents: props.rangeEvents ?? [],
      weekDays: props.weekDays ?? [],
      timeCursor: props.timeCursor ?? props.rangeStart ?? new Date(2026, 6, 15),
      monthCursor: props.monthCursor ?? props.rangeStart ?? new Date(2026, 6, 15),
      monthDays: props.monthDays ?? [],
      monthEvents: props.monthEvents ?? [],
      focusedDay: props.focusedDay ?? null,
      onFocusDay: props.onFocusDay ?? (() => {}),
      events: props.events ?? [],
      filteredEvents: props.filteredEvents ?? [],
      initialLoading: props.initialLoading ?? false,
      isRefreshing: props.isRefreshing ?? false,
      emptyState: props.emptyState ?? "沒有事件",
      sidebarEvents: props.sidebarEvents ?? [],
      sidebarDay: props.sidebarDay ?? null,
      sidebarOutOfView: props.sidebarOutOfView ?? false,
      ...contextOverrides.navigation,
    },
    chrome: {
      viewMode: props.viewMode ?? "calendar",
      monthLayout: contextOverrides.monthLayout ?? "unified",
      ...contextOverrides.chrome,
    },
  });
}

/* ------------------------------------------------------------------ */
/*  TimelineSkeleton (isolated component tests)                        */
/* ------------------------------------------------------------------ */

describe("TimelineSkeleton", () => {
  const mounts: Mount[] = [];

  afterEach(() => {
    unmountAll(mounts);
  });

  function render(viewMode: "calendar" | "gantt") {
    const container = document.createElement("div");
    document.body.appendChild(container);
    let root!: Root;
    act(() => {
      root = createRoot(container);
      root.render(createElement(TimelineSkeleton, { viewMode }));
    });
    mounts.push({ container, root });
    return container;
  }

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
  const mounts: Mount[] = [];

  function renderViewSwitch(
    overrides: ViewSwitchInput = {},
    contextOverrides: TimelinePageContextOverrides = {},
  ) {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const props = makeViewSwitchProps(overrides);
    const ctx = viewSwitchContext(props, contextOverrides);
    let root!: Root;
    act(() => {
      root = createRoot(container);
      root.render(
        withI18n(
          createElement(TimelinePageProvider, {
            value: ctx,
            children: createElement(TimelineViewSwitch, { error: props.error }),
          }),
        ),
      );
    });
    mounts.push({ container, root });
    return {
      container,
      root,
      rerender: (newOverrides: ViewSwitchInput) => {
        const newProps = makeViewSwitchProps(newOverrides);
        const nextCtx = viewSwitchContext(newProps, contextOverrides);
        act(() => {
          root.render(
            withI18n(
              createElement(TimelinePageProvider, {
                value: nextCtx,
                children: createElement(TimelineViewSwitch, { error: newProps.error }),
              }),
            ),
          );
        });
      },
    };
  }

  beforeEach(async () => {
    await ensureZhHantLocale();
    vi.useFakeTimers();
    mockShowToast.mockReset();
  });

  afterEach(() => {
    // Unmount first so useTimelineLoadTimeout clears its pending setTimeout.
    unmountAll(mounts);
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("keeps the main layout mounted while initialLoading (no skeleton swap)", () => {
    const { container } = renderViewSwitch({ initialLoading: true, events: [] });
    expect(container.querySelector('[data-testid="timeline-skeleton"]')).toBeNull();
    expect(container.querySelector('[data-testid="timeline-main-layout"]')).not.toBeNull();
  });

  it("does not overlay the intelligence pipeline guide on an empty month calendar", () => {
    const { container } = renderViewSwitch({
      initialLoading: false,
      events: [],
      filteredEvents: [],
      viewMode: "calendar",
      timeScale: "month",
    });
    expect(container.querySelector('[data-testid="pipeline-guide-checklist"]')).toBeNull();
    expect(container.querySelector('[data-testid="timeline-main-layout"]')).not.toBeNull();
    expect(container.textContent).toContain("沒有事件");
  });

  it("renders calendar main layout while loading (calendar mode)", () => {
    const { container } = renderViewSwitch({
      initialLoading: true,
      events: [],
      viewMode: "calendar",
    });
    expect(container.querySelector('[data-testid="timeline-main-layout"]')).not.toBeNull();
  });

  it("renders gantt main layout while loading (gantt mode)", () => {
    const { container } = renderViewSwitch({
      initialLoading: true,
      events: [],
      viewMode: "gantt",
    });
    expect(container.querySelector('[data-testid="timeline-main-layout"]')).not.toBeNull();
  });

  it("shows a timeout toast while preserving the calendar layout", () => {
    const { container } = renderViewSwitch({
      initialLoading: true,
      events: [],
    });

    expect(container.querySelector('[data-testid="timeline-main-layout"]')).not.toBeNull();
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

    expect(container.querySelector('[data-testid="timeline-main-layout"]')).not.toBeNull();

    // Advance time partially (15s — before timeout)
    act(() => {
      vi.advanceTimersByTime(15_000);
    });

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

  it("does not toast calendar-share unreachable errors", () => {
    const { container } = renderViewSwitch({
      initialLoading: false,
      events: [],
      error: "calendar share 502",
    });

    expect(mockShowToast).not.toHaveBeenCalled();
    expect(container.querySelector('[data-testid="timeline-main-layout"]')).not.toBeNull();
  });

  it("does not toast failed-to-fetch subscribe disconnect", () => {
    renderViewSwitch({
      initialLoading: false,
      events: [],
      error: "Failed to fetch",
    });

    expect(mockShowToast).not.toHaveBeenCalled();
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

  it("keeps grid visible while refreshing with cached events (spinner is in toolbar)", () => {
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
    expect(container.querySelector('[data-testid="timeline-refresh-indicator"]')).toBeNull();
    expect(container.querySelector('[data-testid="timeline-main-layout"]')).not.toBeNull();
  });

  it("hides the day event sidebar in month-cards split layout", () => {
    const { container } = renderViewSwitch(
      { viewMode: "calendar", timeScale: "month" },
      { monthLayout: "split", selectedEvent: null },
    );
    expect(container.querySelector('[data-testid="timeline-event-sidebar"]')).toBeNull();
    expect(container.querySelector('[data-testid="timeline-event-list-header"]')).toBeNull();
    expect(container.textContent).not.toContain("沒有事件");
  });

  it("keeps the day event sidebar on unified month and week", () => {
    const month = renderViewSwitch(
      { viewMode: "calendar", timeScale: "month" },
      { monthLayout: "unified" },
    );
    expect(month.container.querySelector('[data-testid="timeline-event-sidebar"]')).not.toBeNull();
    expect(month.container.querySelector('[data-testid="timeline-event-list-header"]')).not.toBeNull();

    const week = renderViewSwitch(
      { viewMode: "calendar", timeScale: "week" },
      { monthLayout: "split" },
    );
    expect(week.container.querySelector('[data-testid="timeline-event-sidebar"]')).not.toBeNull();
  });
});

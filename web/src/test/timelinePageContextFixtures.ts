/**
 * Shared TimelinePageContext fixture. Callers override the few fields they care
 * about; navigation and chrome deep-merge so a partial slice stays complete.
 */

import { vi } from "vitest";

import type {
  TimelineChromeSlice,
  TimelineNavigationSlice,
  TimelinePageContextValue,
} from "../pages/timeline/TimelinePageContext";

export type TimelinePageContextOverrides = Omit<
  Partial<TimelinePageContextValue>,
  "navigation" | "chrome"
> & {
  navigation?: Partial<TimelineNavigationSlice>;
  chrome?: Partial<TimelineChromeSlice>;
};

function defaultNavigation(): TimelineNavigationSlice {
  const cursor = new Date("2026-07-15T00:00:00.000Z");
  return {
    timeScale: "month",
    rangeStart: cursor,
    rangeEvents: [],
    weekDays: [],
    timeCursor: cursor,
    monthCursor: cursor,
    monthDays: [],
    monthEvents: [],
    focusedDay: null,
    onFocusDay: vi.fn(),
    events: [],
    filteredEvents: [],
    initialLoading: false,
    isRefreshing: false,
    emptyState: "",
    sidebarEvents: [],
    sidebarDay: null,
    sidebarOutOfView: false,
    visibleRangeLabel: "",
    onJumpTo: vi.fn(),
    onMoveCursor: vi.fn(),
    overviewRangeId: "",
  };
}

function defaultChrome(): TimelineChromeSlice {
  return {
    selectedSources: null,
    setSelectedSources: vi.fn(),
    timelineTasks: [],
    worksets: [],
    viewMode: "calendar",
    setViewMode: vi.fn(),
    monthLayout: "unified",
    overviewMode: false,
    showLoadingIndicator: false,
    selectedSubscribeKeys: null,
    subscribeAvailability: "ok",
  };
}

export function makeTimelinePageContext(
  overrides: TimelinePageContextOverrides = {},
): TimelinePageContextValue {
  const { navigation, chrome, ...rest } = overrides;
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
    showDismissed: false,
    showOngoing: true,
    showEnding: true,
    monthDatesRevealed: false,
    taskSpans: [],
    selectedGanttTaskId: null,
    onSelectGanttTask: vi.fn(),
    spansInitialLoading: false,
    spansIsRefreshing: false,
    spansError: null,
    onRetrySpans: vi.fn(),
    selectedGanttSpan: null,
    onCloseGanttPanel: vi.fn(),
    ganttColumns: [],
    timelineEvents: [],
    timelineEventsInitialLoading: false,
    timelineEventsIsRefreshing: false,
    timelineEventsError: null,
    onRetryTimelineEvents: vi.fn(),
    ...rest,
    navigation: { ...defaultNavigation(), ...navigation },
    chrome: { ...defaultChrome(), ...chrome },
  };
}

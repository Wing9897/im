import { fetchCalendarWindow } from "../../api/calendarWindow";
import type { AnalysisEvent } from "../../types";
import type { SourceFilterSelection } from "../tasks/sourceFilterSelection";
import { paddedMonthWindowIso } from "./boardFetchWindows";
import type { TimelineFilterPlan } from "./timelineFilterPlan";
import { filterTimelineWindowEvents } from "./timedEventMergeCore";
import {
  sortEventsByTimeDesc,
  windowItemToBoardEvent,
} from "./timedEventProject";

const EMPTY_EVENTS: AnalysisEvent[] = [];

export type UserEventLabelOpts = {
  taskNameById?: ReadonlyMap<string, string>;
  generalWorksetLabel?: string;
  worksetNameById?: ReadonlyMap<string, string>;
};

/**
 * Shared planner+merge core for Timeline and Board timed-event surfaces.
 *
 * Calendar time-window reads (timeline, board, notify scan) use
 * ``GET /api/v1/calendar/window``. Intelligence pages and the board map keep
 * ``/results/events``.
 */
export type FetchMergedTimedEventsOpts = {
  startIso?: string;
  endIso?: string;
  /** Unused by window fetches; kept for board wrapper signatures. */
  limit?: number;
  /**
   * Analysis fetch style:
   * - ``timed`` — board calendar/gantt/events list window
   * - ``timeline`` — timeline task-filtered window (requires filterPlan)
   */
  analysis?: "timed" | "timeline";
  includeUserEvents?: boolean;
  /** When false, skip recurring + item_remind in the window. */
  includeRrule?: boolean;
  filterPlan?: {
    selectedSources: SourceFilterSelection;
    plan: TimelineFilterPlan;
  };
  userEventLabels?: UserEventLabelOpts;
  sort?: "time_desc" | "none";
  signal?: AbortSignal;
};

function projectWindowItems(
  items: Awaited<ReturnType<typeof fetchCalendarWindow>>,
  labels?: UserEventLabelOpts,
): AnalysisEvent[] {
  return items.map((item) =>
    windowItemToBoardEvent(
      item,
      labels?.taskNameById,
      labels?.generalWorksetLabel,
      labels?.worksetNameById,
    ),
  );
}

/**
 * Single fetch+merge entry used by Timeline and Board thin wrappers.
 */
export async function fetchMergedTimedEvents(
  opts: FetchMergedTimedEventsOpts,
): Promise<AnalysisEvent[]> {
  const {
    startIso,
    endIso,
    includeUserEvents = true,
    includeRrule = true,
    filterPlan,
    userEventLabels,
    sort = "none",
    signal,
  } = opts;

  if (filterPlan) {
    const { selectedSources, plan } = filterPlan;
    if (
      selectedSources !== null &&
      selectedSources.taskIds.length === 0 &&
      selectedSources.worksetIds.length === 0
    ) {
      return EMPTY_EVENTS;
    }
    if (
      !plan.fetchAnalysis &&
      !plan.fetchCalendar &&
      !plan.fetchUserEvents &&
      !plan.fetchItems
    ) {
      return EMPTY_EVENTS;
    }
    if (!startIso || !endIso) {
      return EMPTY_EVENTS;
    }

    const windowParams = {
      startTime: startIso,
      endTime: endIso,
      includeAnalysis: plan.fetchAnalysis,
      includeUser: plan.fetchUserEvents,
      includeRecurring: plan.fetchCalendar,
      includeItems: plan.fetchItems,
    };
    const windowItems = await (signal
      ? fetchCalendarWindow(windowParams, signal)
      : fetchCalendarWindow(windowParams));
    return filterTimelineWindowEvents({
      selectedSources,
      filterPlan: plan,
      events: projectWindowItems(windowItems, userEventLabels),
    });
  }

  if (!startIso || !endIso) {
    return EMPTY_EVENTS;
  }

  const windowParams = {
    startTime: startIso,
    endTime: endIso,
    includeAnalysis: true,
    includeUser: includeUserEvents !== false,
    includeRecurring: includeRrule !== false,
    includeItems: includeRrule !== false,
  };
  const windowItems = await (signal
    ? fetchCalendarWindow(windowParams, signal)
    : fetchCalendarWindow(windowParams));
  const merged = projectWindowItems(windowItems, userEventLabels);
  return sort === "time_desc" ? sortEventsByTimeDesc(merged) : merged;
}

/**
 * Board calendar/gantt: one ``GET /calendar/window``.
 * User-event task names are left unresolved here — callers apply
 * `withResolvedUserEventTaskNames` with the shared task catalog.
 */
export async function fetchMergedTimedBoardEvents(opts: {
  startDate: string;
  endDate: string;
  limit: number;
}): Promise<AnalysisEvent[]> {
  return fetchMergedTimedEvents({
    startIso: opts.startDate,
    endIso: opts.endDate,
    limit: opts.limit,
    analysis: "timed",
    includeUserEvents: true,
    includeRrule: true,
    sort: "none",
  });
}

/**
 * Events-list board widget: same merged occurrences as the month calendar
 * (padded month window), newest first. Cap is applied by the widget after
 * source filter.
 */
export async function fetchBoardEventsList(opts: {
  limit?: number;
} = {}): Promise<AnalysisEvent[]> {
  const { startDate, endDate } = paddedMonthWindowIso();
  return fetchMergedTimedEvents({
    startIso: startDate,
    endIso: endDate,
    limit: opts.limit ?? 15,
    analysis: "timed",
    includeUserEvents: true,
    includeRrule: true,
    sort: "time_desc",
  });
}

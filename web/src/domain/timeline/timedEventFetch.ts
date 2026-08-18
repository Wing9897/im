import type { UserEvent } from "../../api/userEvents";
import { listUserEventsPage } from "../../api/userEvents";
import { fetchEvents } from "../../api/results";
import type { SourceFilterSelection } from "../tasks/sourceFilterSelection";
import {
  fetchSharedCalendarItems,
  fetchSharedTimedAnalysisPage,
  fetchSharedTimelineEvents,
  fetchSharedUserEvents,
} from "./sharedCalendarFetch";
import type { TimelineFilterPlan } from "./timelineFilterPlan";
import {
  mergeTimelineFilterSources,
  mergeWithCalendarOccurrences,
} from "./timedEventMergeCore";
import {
  sortEventsByTimeDesc,
  userEventToBoardEvent,
  userEventToTimelineItem,
} from "./timedEventProject";
import type { AnalysisEvent, CalendarOccurrence, TimelineItem } from "../../types";

const EMPTY_EVENTS: TimelineItem[] = [];

export type UserEventLabelOpts = {
  taskNameById?: ReadonlyMap<string, string>;
  generalWorksetLabel?: string;
  worksetNameById?: ReadonlyMap<string, string>;
};

/**
 * Shared planner+merge core for Timeline and Board timed-event surfaces.
 *
 * Options:
 * - ``filterPlan`` — Timeline source-filter aware fetch + client merge
 * - ``includeRrule`` — pull RRULE / item calendar rows (Board window = true; events list = false)
 * - ``sort`` — optional ``time_desc`` (events-list widget)
 */
export type FetchMergedTimedEventsOpts = {
  startIso?: string;
  endIso?: string;
  /** Timed analysis page limit (board window) or recent-list limit. */
  limit?: number;
  /**
   * Analysis fetch style:
   * - ``timed`` — hasTime window page (Board calendar/gantt)
   * - ``timeline`` — timeline task-filtered window (requires filterPlan)
   * - ``recent`` — analyzed_at list (Events board widget)
   * - ``none`` — skip analysis
   */
  analysis?: "timed" | "timeline" | "recent" | "none";
  includeUserEvents?: boolean | "unbounded";
  /** When false, skip calendar/occurrences. Object form passes series filter to shared fetch. */
  includeRrule?:
    | boolean
    | {
        seriesIds?: string[] | null;
        includeItems?: boolean;
      };
  filterPlan?: {
    selectedSources: SourceFilterSelection;
    plan: TimelineFilterPlan;
  };
  userEventLabels?: UserEventLabelOpts;
  sort?: "time_desc" | "none";
};

function resolveIncludeRrule(
  includeRrule: FetchMergedTimedEventsOpts["includeRrule"],
): false | { seriesIds?: string[] | null; includeItems?: boolean } {
  if (includeRrule === false || includeRrule === undefined) return false;
  if (includeRrule === true) return {};
  return includeRrule;
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
    limit = 15,
    analysis = "timed",
    includeUserEvents = true,
    includeRrule = true,
    filterPlan,
    userEventLabels,
    sort = "none",
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

    const needCalendar = plan.fetchCalendar || plan.fetchItems;
    const [analysisEvents, calendarOccurrences, rawUserEvents] = await Promise.all([
      plan.fetchAnalysis
        ? fetchSharedTimelineEvents({
            taskIds: plan.analysisTaskIds,
            startDate: startIso,
            endDate: endIso,
          })
        : Promise.resolve(EMPTY_EVENTS),
      needCalendar
        ? fetchSharedCalendarItems(
            startIso,
            endIso,
            plan.fetchCalendar
              ? plan.seriesIds === null
                ? { includeItems: true }
                : { seriesIds: plan.seriesIds, includeItems: true }
              : { seriesIds: [], includeItems: true },
          )
        : Promise.resolve([] as CalendarOccurrence[]),
      plan.fetchUserEvents
        ? fetchSharedUserEvents({ start: startIso, end: endIso })
        : Promise.resolve([] as UserEvent[]),
    ]);

    const userEvents = rawUserEvents
      .map((event) =>
        userEventToTimelineItem(
          event,
          userEventLabels?.taskNameById,
          userEventLabels?.generalWorksetLabel,
          userEventLabels?.worksetNameById,
        ),
      )
      .filter((event): event is TimelineItem => event !== null);

    return mergeTimelineFilterSources({
      selectedSources,
      filterPlan: plan,
      analysisEvents,
      calendarOccurrences,
      userEvents,
    });
  }

  const rruleOpts = resolveIncludeRrule(includeRrule);
  const wantUser = includeUserEvents !== false;
  const unboundedUser = includeUserEvents === "unbounded";

  const [analysisEvents, userEvents, calendarOccurrences] = await Promise.all([
    analysis === "timed" && startIso && endIso
      ? fetchSharedTimedAnalysisPage({ startDate: startIso, endDate: endIso, limit })
      : analysis === "recent"
        ? fetchEvents({
            limit,
            offset: 0,
            sort: "analyzed_at",
            includeTotal: false,
          }).then((page) => page.items)
        : Promise.resolve([] as AnalysisEvent[]),
    wantUser
      ? unboundedUser
        ? listUserEventsPage().then((page) => page.items)
        : startIso && endIso
          ? fetchSharedUserEvents({ start: startIso, end: endIso })
          : listUserEventsPage().then((page) => page.items)
      : Promise.resolve([] as UserEvent[]),
    rruleOpts && startIso && endIso
      ? fetchSharedCalendarItems(startIso, endIso, {
          // null means "all series" — the shared fetch expects the filter omitted.
          seriesIds: rruleOpts.seriesIds ?? undefined,
          includeItems: rruleOpts.includeItems,
        })
      : Promise.resolve([] as CalendarOccurrence[]),
  ]);

  const projectedUsers = userEvents.map((event) =>
    userEventToBoardEvent(
      event,
      userEventLabels?.taskNameById,
      userEventLabels?.generalWorksetLabel,
      userEventLabels?.worksetNameById,
    ),
  );

  const merged = rruleOpts
    ? mergeWithCalendarOccurrences([...analysisEvents, ...projectedUsers], calendarOccurrences)
    : [...analysisEvents, ...projectedUsers];

  return sort === "time_desc" ? sortEventsByTimeDesc(merged) : merged;
}

/**
 * Board calendar/gantt: timed analysis + user_events + RRULE calendar.
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
 * Events-list board widget: recent analysis (analyzed_at) + all user_events.
 * Intentionally omits RRULE / `item_remind` (schedule + items widgets own those).
 */
export async function fetchBoardEventsList(opts: {
  limit?: number;
} = {}): Promise<AnalysisEvent[]> {
  return fetchMergedTimedEvents({
    limit: opts.limit ?? 15,
    analysis: "recent",
    includeUserEvents: "unbounded",
    includeRrule: false,
    sort: "time_desc",
  });
}

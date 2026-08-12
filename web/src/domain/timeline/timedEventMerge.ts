import type { UserEvent } from "../../api/userEvents";
import { listUserEventsPage } from "../../api/userEvents";
import { fetchEvents } from "../../api/results";
import { formatItemOccurrenceTitle } from "../items/itemCalendarProjection";
import { getEventTimestamp } from "../intelligence/mapFilters";
import { userEventMatchesSourceSelection } from "../tasks/sourceFilterSelection";
import type { SourceFilterSelection } from "../tasks/sourceFilterSelection";
import {
  fetchSharedCalendarItems,
  fetchSharedTimedAnalysisPage,
  fetchSharedTimelineEvents,
  fetchSharedUserEvents,
} from "./sharedCalendarFetch";
import type { TimelineFilterPlan } from "./timelineFilterPlan";
import { resolveUserEventTaskName } from "./userEvents";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import type { AnalysisEvent, CalendarOccurrence, TimelineItem } from "../../types";
import { asTimedAnalysisEvent } from "../../types/timelineItem";

const EMPTY_EVENTS: TimelineItem[] = [];

export function sortEventsByTimeDesc(events: AnalysisEvent[]): AnalysisEvent[] {
  return [...events].sort(
    (a, b) =>
      new Date(getEventTimestamp(b)).getTime() - new Date(getEventTimestamp(a)).getTime(),
  );
}

/**
 * Projects manual / assistant events into the shared timed-event contract
 * (board widgets + timeline).
 *
 * - `taskId`: analysis-task provenance only (empty → null); never ownership.
 * - `worksetId`: ownership (DDL NOT NULL; defaults to builtin system workset).
 */
export function userEventToBoardEvent(
  event: UserEvent,
  taskNameById?: ReadonlyMap<string, string>,
  generalWorksetLabel?: string,
  worksetNameById?: ReadonlyMap<string, string>,
): AnalysisEvent {
  const provenance = typeof event.taskId === "string" ? event.taskId.trim() : "";
  const worksetId = event.worksetId?.trim() || SYSTEM_WORKSET_ID;
  return {
    id: event.id,
    taskId: provenance || null,
    version: 1,
    batchId: "",
    title: event.title,
    body: event.body ?? "",
    startTime: event.startTime,
    endTime: event.endTime,
    location: event.location ?? null,
    latitude: null,
    longitude: null,
    participants: [],
    sourceMessageId: null,
    sourcePlatform: null,
    sourceChannelName: null,
    sourceMessageTime: null,
    analysisTimeRange: null,
    batchSourceChannelNames: [],
    taskName: resolveUserEventTaskName(
      event.taskId,
      taskNameById,
      generalWorksetLabel,
      worksetId,
      worksetNameById,
    ),
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
    source: "user",
    origin: event.origin,
    isAllDay: event.isAllDay,
    timezone: event.timezone ?? null,
    dismissed: Boolean(event.dismissed),
    important: Boolean(event.important),
    worksetId,
    itemId: event.itemId?.trim() || null,
    remindBeforeDays:
      typeof event.remindBeforeDays === "number" ? event.remindBeforeDays : null,
  };
}

/** Timeline projection: same as board, but requires `startTime`. */
export function userEventToTimelineItem(
  event: UserEvent,
  taskNameById?: ReadonlyMap<string, string>,
  generalWorksetLabel?: string,
  worksetNameById?: ReadonlyMap<string, string>,
): TimelineItem | null {
  return asTimedAnalysisEvent(
    userEventToBoardEvent(event, taskNameById, generalWorksetLabel, worksetNameById),
  );
}

/**
 * Re-resolve `taskName` on the user_event rows of an already-fetched board list.
 * Names come from `TaskCatalogContext` at render time, so the fetcher stays
 * free of a second `/tasks` request and renames land without a poll cycle.
 */
export function withResolvedUserEventTaskNames(
  events: readonly AnalysisEvent[],
  taskNameById: ReadonlyMap<string, string>,
  generalWorksetLabel?: string,
  worksetNameById?: ReadonlyMap<string, string>,
): AnalysisEvent[] {
  return events.map((event) =>
    event.source === "user"
      ? {
          ...event,
          taskName: resolveUserEventTaskName(
            event.taskId,
            taskNameById,
            generalWorksetLabel,
            event.worksetId,
            worksetNameById,
          ),
        }
      : event,
  );
}

/** Projects an expanded RRULE / item calendar row into the board timed-event contract. */
export function calendarOccurrenceToBoardEvent(
  occurrence: CalendarOccurrence,
): AnalysisEvent {
  const isItem = occurrence.source === "item_remind";
  const bareTitle = occurrence.title || "";
  const seriesId = isItem ? null : occurrence.seriesId || null;
  return {
    id: occurrence.id,
    taskId: null,
    seriesId,
    version: 1,
    batchId: "",
    title: isItem
      ? formatItemOccurrenceTitle(occurrence.itemDateKind, bareTitle)
      : bareTitle,
    body: occurrence.description ?? "",
    startTime: occurrence.startTime,
    endTime: occurrence.endTime,
    location: occurrence.location ?? null,
    latitude: null,
    longitude: null,
    participants: [],
    sourceMessageId: null,
    sourcePlatform: null,
    sourceChannelName: null,
    sourceMessageTime: null,
    analysisTimeRange: null,
    batchSourceChannelNames: [],
    taskName: isItem ? null : occurrence.taskName || null,
    createdAt: occurrence.startTime,
    updatedAt: occurrence.startTime,
    source: isItem ? "item_remind" : "recurring",
    isAllDay: occurrence.isAllDay,
    timezone: occurrence.timezone ?? null,
    dismissed: Boolean(occurrence.dismissed),
    important: Boolean(occurrence.important),
    isLastOccurrence: isItem ? undefined : Boolean(occurrence.isLastOccurrence),
    // Keep worksetId for source-filter alignment with Timeline (RRULE + items).
    worksetId: isItem
      ? occurrence.worksetId?.trim() || SYSTEM_WORKSET_ID
      : occurrence.worksetId?.trim() || undefined,
    itemId: occurrence.itemId?.trim() || null,
    // Server projects remind only.
    itemDateKind: isItem ? "remind" : undefined,
  };
}

function timedKey(
  seriesOrTaskId: string | null | undefined,
  startTime: string | null | undefined,
): string | null {
  if (!seriesOrTaskId || !startTime) {
    return null;
  }
  const timestamp = new Date(startTime).getTime();
  return `${seriesOrTaskId}|${Number.isNaN(timestamp) ? startTime : timestamp}`;
}

/**
 * Append recurring RRULE occurrences after analysis / user events.
 * Skips rows that already match by id or by seriesId+startTime to avoid double bars.
 */
export function mergeWithCalendarOccurrences(
  timedEvents: AnalysisEvent[],
  occurrences: CalendarOccurrence[],
): AnalysisEvent[] {
  if (occurrences.length === 0) {
    return timedEvents;
  }
  const ids = new Set(timedEvents.map((event) => event.id));
  const keys = new Set<string>();
  for (const event of timedEvents) {
    // Dedupe against RRULE rows by seriesId only — never taskId
    // (analysis/user provenance is a separate id namespace).
    const key = timedKey(event.seriesId, event.startTime);
    if (key) {
      keys.add(key);
    }
  }
  const extras: AnalysisEvent[] = [];
  for (const occurrence of occurrences) {
    if (ids.has(occurrence.id)) {
      continue;
    }
    const key = timedKey(occurrence.seriesId, occurrence.startTime);
    if (key && keys.has(key)) {
      continue;
    }
    extras.push(calendarOccurrenceToBoardEvent(occurrence));
    ids.add(occurrence.id);
    if (key) {
      keys.add(key);
    }
  }
  return extras.length === 0 ? timedEvents : [...timedEvents, ...extras];
}

function isItemOccurrence(occurrence: CalendarOccurrence): boolean {
  return occurrence.source === "item_remind";
}

function itemOccurrenceToTimelineItem(occurrence: CalendarOccurrence): TimelineItem | null {
  return asTimedAnalysisEvent(calendarOccurrenceToBoardEvent(occurrence));
}

/**
 * Client-filter + RRULE merge for Timeline (same id / taskId|startTime dedupe as Board).
 */
export function mergeTimelineFilterSources(opts: {
  selectedSources: SourceFilterSelection;
  filterPlan: TimelineFilterPlan;
  analysisEvents: readonly TimelineItem[];
  calendarOccurrences: readonly CalendarOccurrence[];
  userEvents: readonly TimelineItem[];
}): TimelineItem[] {
  const {
    selectedSources,
    filterPlan,
    analysisEvents,
    calendarOccurrences,
    userEvents,
  } = opts;

  if (
    selectedSources !== null &&
    selectedSources.taskIds.length === 0 &&
    selectedSources.worksetIds.length === 0
  ) {
    return EMPTY_EVENTS;
  }

  const analysis = filterPlan.fetchAnalysis ? [...analysisEvents] : EMPTY_EVENTS;
  const allow = new Set(filterPlan.selectedRealTaskIds);
  const allowWorksets = new Set(filterPlan.selectedWorksetIds);
  const allowExplicitTasks = new Set(filterPlan.explicitTaskIds);
  const isAll = selectedSources === null;

  const recurringOccurrences = calendarOccurrences.filter((row) => !isItemOccurrence(row));
  const itemOccurrences = calendarOccurrences.filter(isItemOccurrence);

  const calendarFiltered = filterPlan.fetchCalendar
    ? isAll
      ? [...recurringOccurrences]
      : recurringOccurrences.filter(
          (occurrence) =>
            (occurrence.seriesId != null &&
              occurrence.seriesId !== "" &&
              allow.has(occurrence.seriesId)) ||
            (occurrence.worksetId != null &&
              allowWorksets.has(occurrence.worksetId)),
        )
    : [];

  const users = filterPlan.fetchUserEvents
    ? isAll
      ? [...userEvents]
      : userEvents.filter((event) =>
          userEventMatchesSourceSelection(event, allowWorksets, allowExplicitTasks),
        )
    : EMPTY_EVENTS;

  const itemEvents = filterPlan.fetchItems
    ? (isAll
        ? itemOccurrences
        : itemOccurrences.filter((occurrence) => {
            const wid =
              typeof occurrence.worksetId === "string" && occurrence.worksetId.trim()
                ? occurrence.worksetId.trim()
                : SYSTEM_WORKSET_ID;
            return allowWorksets.has(wid);
          })
      )
        .map(itemOccurrenceToTimelineItem)
        .filter((event): event is TimelineItem => event !== null)
    : EMPTY_EVENTS;

  return mergeWithCalendarOccurrences(
    [...analysis, ...users, ...itemEvents],
    calendarFiltered,
  ) as TimelineItem[];
}

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
  /** When false, skip calendar/items. Object form passes series filter to shared fetch. */
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
      ? fetchSharedCalendarItems(startIso, endIso, rruleOpts)
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

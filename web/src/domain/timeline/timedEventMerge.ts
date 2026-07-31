import type { UserEvent } from "../../api/userEvents";
import { listUserEvents } from "../../api/userEvents";
import { fetchCalendarOccurrences, fetchEvents } from "../../api/results";
import { getEventTimestamp } from "../intelligence/mapFilters";
import { resolveUserEventTaskName } from "./userEvents";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import type { AnalysisEvent, CalendarOccurrence, TimelineItem } from "../../types";
import { asTimedAnalysisEvent } from "../../types/timelineItem";

function sortEventsByTimeDesc(events: AnalysisEvent[]): AnalysisEvent[] {
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
    location: event.location,
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
    dismissed: Boolean(event.dismissed),
    worksetId,
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

/** Projects an expanded RRULE occurrence into the board timed-event contract. */
export function calendarOccurrenceToBoardEvent(
  occurrence: CalendarOccurrence,
): AnalysisEvent {
  return {
    id: occurrence.id,
    taskId: occurrence.taskId,
    version: 1,
    batchId: "",
    title: occurrence.title,
    body: occurrence.description ?? "",
    startTime: occurrence.startTime,
    endTime: occurrence.endTime,
    location: occurrence.location,
    latitude: null,
    longitude: null,
    participants: [],
    sourceMessageId: null,
    sourcePlatform: null,
    sourceChannelName: null,
    sourceMessageTime: null,
    analysisTimeRange: null,
    batchSourceChannelNames: [],
    taskName: occurrence.taskName,
    createdAt: occurrence.startTime,
    updatedAt: occurrence.startTime,
    source: "recurring",
    isAllDay: occurrence.isAllDay,
    dismissed: Boolean(occurrence.dismissed),
  };
}

function timedKey(
  taskId: string | null | undefined,
  startTime: string | null | undefined,
): string | null {
  if (!taskId || !startTime) {
    return null;
  }
  return `${taskId}|${startTime}`;
}

/**
 * Append recurring RRULE occurrences after analysis / user events.
 * Skips rows that already match by id or by taskId+startTime to avoid double bars.
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
    const key = timedKey(event.taskId, event.startTime);
    if (key) {
      keys.add(key);
    }
  }
  const extras: AnalysisEvent[] = [];
  for (const occurrence of occurrences) {
    if (ids.has(occurrence.id)) {
      continue;
    }
    const key = timedKey(occurrence.taskId, occurrence.startTime);
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

/**
 * Shared board fetch: timed analysis events + user_events + RRULE calendar.
 * User-event task names are left unresolved here — callers apply
 * `withResolvedUserEventTaskNames` with the shared task catalog.
 */
export async function fetchMergedTimedBoardEvents(opts: {
  startDate: string;
  endDate: string;
  limit: number;
}): Promise<AnalysisEvent[]> {
  const { startDate, endDate, limit } = opts;
  const [analysisEvents, userEvents, calendarOccurrences] = await Promise.all([
    fetchEvents({
      startDate,
      endDate,
      hasTime: true,
      requireIncludeInTimeline: true,
      limit,
      offset: 0,
      sort: "event_time",
      includeTotal: false,
    }).then((page) => page.items),
    listUserEvents({ start: startDate, end: endDate }),
    fetchCalendarOccurrences(startDate, endDate),
  ]);
  return mergeWithCalendarOccurrences(
    [...analysisEvents, ...userEvents.map((event) => userEventToBoardEvent(event))],
    calendarOccurrences,
  );
}

/**
 * Events-list board widget fetch: recent analysis events (analyzed_at) + all
 * user_events. Does not include RRULE calendar unless `includeCalendar` is set
 * with a date window (not used by the events list today).
 */
export async function fetchBoardEventsList(opts: {
  includeCalendar?: boolean;
  limit?: number;
  startDate?: string;
  endDate?: string;
} = {}): Promise<AnalysisEvent[]> {
  const { includeCalendar = false, limit = 15, startDate, endDate } = opts;
  const [analysisEvents, userEvents, calendarOccurrences] = await Promise.all([
    fetchEvents({
      limit,
      offset: 0,
      sort: "analyzed_at",
      includeTotal: false,
    }).then((page) => page.items),
    // Unbounded list stays small under retention; merge so「一般」filter works.
    listUserEvents(),
    includeCalendar && startDate && endDate
      ? fetchCalendarOccurrences(startDate, endDate)
      : Promise.resolve([] as CalendarOccurrence[]),
  ]);
  const merged = includeCalendar
    ? mergeWithCalendarOccurrences(
        [...analysisEvents, ...userEvents.map((event) => userEventToBoardEvent(event))],
        calendarOccurrences,
      )
    : [...analysisEvents, ...userEvents.map((event) => userEventToBoardEvent(event))];
  return sortEventsByTimeDesc(merged);
}

import type { UserEvent } from "../../api/userEvents";
import { formatItemOccurrenceTitle } from "../items/itemCalendarProjection";
import { getEventTimestamp } from "../intelligence/mapFilters";
import { resolveUserEventTaskName } from "./userEvents";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import type { AnalysisEvent, CalendarOccurrence, TimelineItem } from "../../types";
import { asTimedAnalysisEvent } from "../../types/timelineItem";

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

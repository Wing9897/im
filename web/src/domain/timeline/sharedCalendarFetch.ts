/**
 * Shared Calendar/Timeline fetch helpers.
 *
 * RRULE expansions go through `/api/v1/calendar/items`. Analysis timed events
 * and user events remain separate endpoints (server contract), but in-flight
 * requests with the same key are coalesced so Board widgets + Timeline do not
 * hammer the API in parallel.
 */

import { listUserEvents, type UserEvent } from "../../api/userEvents";
import {
  fetchCalendarOccurrences,
  fetchEvents,
  fetchTimelineEvents,
} from "../../api/results";
import { coalesceAsync } from "../../utils/coalesceAsync";
import type { AnalysisEvent, CalendarOccurrence, TimelineItem } from "../../types";

function taskIdsKey(taskIds: string[] | null | undefined): string {
  if (taskIds === undefined) return "*";
  if (taskIds === null) return "*";
  if (taskIds.length === 0) return "∅";
  return [...taskIds].sort().join(",");
}

export function fetchSharedCalendarItems(
  rangeStart: string,
  rangeEnd: string,
  opts?: { taskId?: string; taskIds?: string[] },
): Promise<CalendarOccurrence[]> {
  const key = [
    "calendar-items",
    rangeStart,
    rangeEnd,
    opts?.taskIds !== undefined
      ? `ids:${taskIdsKey(opts.taskIds)}`
      : opts?.taskId
        ? `id:${opts.taskId}`
        : "*",
  ].join("|");
  return coalesceAsync(key, () => fetchCalendarOccurrences(rangeStart, rangeEnd, opts));
}

export function fetchSharedUserEvents(opts: {
  start?: string;
  end?: string;
}): Promise<UserEvent[]> {
  const key = ["user-events", opts.start ?? "", opts.end ?? ""].join("|");
  return coalesceAsync(key, () => listUserEvents(opts));
}

export function fetchSharedTimelineEvents(opts: {
  taskIds?: string[] | null;
  startDate: string;
  endDate: string;
}): Promise<TimelineItem[]> {
  const key = [
    "timeline-events",
    opts.startDate,
    opts.endDate,
    taskIdsKey(opts.taskIds ?? null),
  ].join("|");
  return coalesceAsync(key, () =>
    fetchTimelineEvents({
      taskIds: opts.taskIds === null ? undefined : opts.taskIds,
      startDate: opts.startDate,
      endDate: opts.endDate,
    }),
  );
}

/** Board-style single-page timed analysis window (hasTime + timeline flag). */
export function fetchSharedTimedAnalysisPage(opts: {
  startDate: string;
  endDate: string;
  limit: number;
}): Promise<AnalysisEvent[]> {
  const key = [
    "timed-analysis-page",
    opts.startDate,
    opts.endDate,
    String(opts.limit),
  ].join("|");
  return coalesceAsync(key, () =>
    fetchEvents({
      startDate: opts.startDate,
      endDate: opts.endDate,
      hasTime: true,
      requireIncludeInTimeline: true,
      limit: opts.limit,
      offset: 0,
      sort: "event_time",
      includeTotal: false,
    }).then((page) => page.items),
  );
}

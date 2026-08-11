/**
 * Shared Calendar/Timeline fetch helpers.
 *
 * RRULE + item DATE projections go through `/api/v1/calendar/items`
 * (`source=recurring` / `source=item_remind`). `source=item_remind` is remind projection
 * only — distinct from item-linked `user_events` (`source=user` + itemId +
 * kind). Analysis timed events and user events remain separate endpoints
 * (server contract), but in-flight requests with the same key are coalesced
 * so Board widgets + Timeline do not hammer the API in parallel.
 */

import { listUserEventsPage, type UserEvent } from "../../api/userEvents";
import {
  fetchCalendarOccurrences,
  fetchEvents,
  fetchTimelineEvents,
} from "../../api/results";
import { coalesceAsync } from "../../utils/coalesceAsync";
import type { AnalysisEvent, CalendarOccurrence, TimelineItem } from "../../types";

function idListKey(ids: string[] | null | undefined): string {
  if (ids === undefined) return "*";
  if (ids === null) return "*";
  if (ids.length === 0) return "∅";
  return [...ids].sort().join(",");
}

export function fetchSharedCalendarItems(
  rangeStart: string,
  rangeEnd: string,
  opts?: { seriesId?: string; seriesIds?: string[]; includeItems?: boolean },
): Promise<CalendarOccurrence[]> {
  const includeItems = opts?.includeItems !== false;
  const key = [
    "calendar-items",
    rangeStart,
    rangeEnd,
    opts?.seriesIds !== undefined
      ? `ids:${idListKey(opts.seriesIds)}`
      : opts?.seriesId
        ? `id:${opts.seriesId}`
        : "*",
    includeItems ? "items" : "no-items",
  ].join("|");
  return coalesceAsync(key, () => fetchCalendarOccurrences(rangeStart, rangeEnd, opts));
}

export function fetchSharedUserEvents(opts: {
  start?: string;
  end?: string;
}): Promise<UserEvent[]> {
  const key = ["user-events", opts.start ?? "", opts.end ?? ""].join("|");
  return coalesceAsync(key, async () => (await listUserEventsPage(opts)).items);
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
    idListKey(opts.taskIds ?? null),
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

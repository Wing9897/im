import type { TimelineItem } from "../../types";
import {
  addDays,
  startOfDay,
  timelineEventDateRange,
} from "../../domain/timeline/dateUtils";

/**
 * Whether an event intersects the local calendar day `[day, day+1)`.
 * Uses half-open occupancy `[start, end)`; midnight-exact ends are exclusive
 * (all-day / overnight conventions). Point events match the day they start on.
 */
export function eventOverlapsLocalDay(event: TimelineItem, day: Date): boolean {
  const { start, end: rawEnd } = timelineEventDateRange(event);
  if (Number.isNaN(start.getTime())) return false;
  const end = Number.isNaN(rawEnd.getTime()) || rawEnd < start ? start : rawEnd;
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);

  if (end.getTime() === start.getTime()) {
    return start >= dayStart && start < dayEnd;
  }
  // Half-open [start, end): midnight-exact `end` is already the exclusive bound.
  return start < dayEnd && end > dayStart;
}

/**
 * Compute sidebar events: if a day is focused, keep events intersecting that
 * local day (including cross-day spans that end or cover it); otherwise all
 * range events.
 */
export function computeSidebarEvents(
  focusedDay: Date | null,
  rangeEvents: TimelineItem[],
): TimelineItem[] {
  if (!focusedDay) return rangeEvents;
  return rangeEvents.filter((event) => eventOverlapsLocalDay(event, focusedDay));
}

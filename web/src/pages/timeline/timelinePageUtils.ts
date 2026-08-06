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
 * Resolve the sidebar list day: explicit focus, else today.
 * The right-hand event list is always day-scoped (never the full view range).
 */
export function resolveSidebarDay(focusedDay: Date | null, now = new Date()): Date {
  return focusedDay ? startOfDay(focusedDay) : startOfDay(now);
}

/**
 * Sidebar events for one local day (default today when focus is cleared).
 * Includes cross-day spans that end or cover that day.
 */
export function computeSidebarEvents(
  focusedDay: Date | null,
  rangeEvents: TimelineItem[],
  now = new Date(),
): TimelineItem[] {
  const day = resolveSidebarDay(focusedDay, now);
  return rangeEvents.filter((event) => eventOverlapsLocalDay(event, day));
}

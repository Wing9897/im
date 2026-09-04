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

/** Whether a local calendar day overlaps the half-open visible window. */
export function dayOverlapsVisibleWindow(
  day: Date,
  rangeStart: Date,
  rangeEnd: Date,
): boolean {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);
  return dayStart.getTime() < rangeEnd.getTime() && dayEnd.getTime() > rangeStart.getTime();
}

/**
 * Sidebar day for a panned 全局 window: keep focusedDay when it still intersects
 * the visible range; otherwise follow the window center so the list is not an
 * empty "no events" for a day that is simply off-screen.
 */
export function resolveSidebarFocusForWindow(
  focusedDay: Date | null,
  rangeStart: Date,
  rangeEnd: Date,
  now = new Date(),
): { day: Date; outOfView: boolean } {
  const intended = resolveSidebarDay(focusedDay, now);
  if (dayOverlapsVisibleWindow(intended, rangeStart, rangeEnd)) {
    return { day: intended, outOfView: false };
  }
  const center = new Date((rangeStart.getTime() + rangeEnd.getTime()) / 2);
  return { day: startOfDay(center), outOfView: true };
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

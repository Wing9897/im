import type { TimelineItem } from "../../types";
import {
  addDays,
  isSameDay,
  startOfDay,
  timelineEventDateRange,
} from "./dateUtils";

/** Temporal phase of an event relative to "now" (not annotation status). */
export type EventTimePhase = "upcoming" | "ongoing" | "ended";

/**
 * Calendar end day for all-day / midnight-exact ranges.
 * Midnight-exact ends are exclusive (last active day = previous day).
 */
function effectiveEndDay(start: Date, end: Date): Date {
  const endDay = startOfDay(end);
  if (end.getTime() === endDay.getTime() && end > start) {
    return addDays(endDay, -1);
  }
  return endDay;
}

/**
 * Reference instant for day-focused list phases.
 * - Today: wall-clock `now` (morning meetings become ended, etc.)
 * - Future day: local midnight of that day (overnight ending that morning → ongoing)
 * - Past day: just before next midnight (day's schedule is fully resolved)
 */
export function dayPhaseAnchor(focusedDay: Date, now: Date = new Date()): Date {
  const dayStart = startOfDay(focusedDay);
  const dayEnd = addDays(dayStart, 1);
  if (now < dayStart) return dayStart;
  if (now >= dayEnd) return new Date(dayEnd.getTime() - 1);
  return now;
}

/** True when the event's active local days span more than one calendar day. */
export function isCrossDayEvent(event: TimelineItem): boolean {
  const { start, end: rawEnd } = timelineEventDateRange(event);
  if (Number.isNaN(start.getTime())) return false;
  const end = Number.isNaN(rawEnd.getTime()) || rawEnd < start ? start : rawEnd;
  return !isSameDay(startOfDay(start), effectiveEndDay(start, end));
}

/**
 * Classify an event as upcoming / ongoing / ended vs `now`.
 *
 * Timed: upcoming when start > now; ongoing when start ≤ now < end; ended when end ≤ now.
 * Point events (no end / end ≤ start): upcoming before start, else ended.
 *
 * All-day: wall-date span with exclusive midnight ends — ongoing for the whole
 * local calendar day(s); ended once the last active day has passed.
 */
export function classifyEventTimePhase(
  event: TimelineItem,
  now: Date = new Date(),
): EventTimePhase {
  const { start, end: rawEnd } = timelineEventDateRange(event);
  if (Number.isNaN(start.getTime())) return "ended";
  const end = Number.isNaN(rawEnd.getTime()) || rawEnd < start ? start : rawEnd;

  if (event.isAllDay) {
    const startDay = startOfDay(start);
    const lastDay = effectiveEndDay(start, end);
    const endExclusive = addDays(lastDay, 1);
    if (now < startDay) return "upcoming";
    if (now < endExclusive) return "ongoing";
    return "ended";
  }

  if (now < start) return "upcoming";
  if (end > start && now < end) return "ongoing";
  return "ended";
}

export type EventsByTimePhase = {
  upcoming: TimelineItem[];
  ongoing: TimelineItem[];
  ended: TimelineItem[];
};

/** Partition events by time phase, preserving relative order within each bucket. */
export function groupEventsByTimePhase(
  events: TimelineItem[],
  now: Date = new Date(),
): EventsByTimePhase {
  const upcoming: TimelineItem[] = [];
  const ongoing: TimelineItem[] = [];
  const ended: TimelineItem[] = [];
  for (const event of events) {
    const phase = classifyEventTimePhase(event, now);
    if (phase === "upcoming") upcoming.push(event);
    else if (phase === "ongoing") ongoing.push(event);
    else ended.push(event);
  }
  return { upcoming, ongoing, ended };
}

/**
 * Day-focused sidebar grouping: phases are relative to the selected local day
 * (via {@link dayPhaseAnchor}), not raw wall-clock "upcoming vs now".
 */
export function groupEventsByDayTimePhase(
  events: TimelineItem[],
  focusedDay: Date,
  now: Date = new Date(),
): EventsByTimePhase {
  return groupEventsByTimePhase(events, dayPhaseAnchor(focusedDay, now));
}

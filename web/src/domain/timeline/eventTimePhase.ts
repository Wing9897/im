import type { TimelineItem } from "../../types";
import {
  addDays,
  isSameDay,
  startOfDay,
  timelineEventDateRange,
} from "./dateUtils";
import { classifyMonthDaySpan } from "./monthDaySpanIndicators";

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
 * - Future day: local midnight of that day
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

/**
 * Day-focused sidebar buckets.
 * Multi-day middle / end days reuse month-cell span semantics
 * (`+N ongoing` / `+N ending`); same-day (or start-day) items use
 * {@link dayPhaseAnchor} time phases.
 */
export type EventsByFocusedDay = EventsByTimePhase & {
  /** Middle of a multi-day span (month-cell「+N 進行中」). */
  covering: TimelineItem[];
  /** Ends on the focused day after starting earlier (month-cell「+N 完結」). */
  endingSpan: TimelineItem[];
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
 * Day-focused sidebar grouping aligned with month span chips:
 * - covering / endingSpan ← {@link classifyMonthDaySpan}
 * - upcoming / ongoing / ended ← start-day (or single-day) vs {@link dayPhaseAnchor}
 */
export function groupEventsByDayTimePhase(
  events: TimelineItem[],
  focusedDay: Date,
  now: Date = new Date(),
): EventsByFocusedDay {
  const anchor = dayPhaseAnchor(focusedDay, now);
  const upcoming: TimelineItem[] = [];
  const ongoing: TimelineItem[] = [];
  const ended: TimelineItem[] = [];
  const covering: TimelineItem[] = [];
  const endingSpan: TimelineItem[] = [];

  for (const event of events) {
    const span = classifyMonthDaySpan(event, focusedDay);
    if (span === "ongoing") {
      covering.push(event);
      continue;
    }
    if (span === "ending") {
      endingSpan.push(event);
      continue;
    }
    const phase = classifyEventTimePhase(event, anchor);
    if (phase === "upcoming") upcoming.push(event);
    else if (phase === "ongoing") ongoing.push(event);
    else ended.push(event);
  }

  return { upcoming, ongoing, ended, covering, endingSpan };
}

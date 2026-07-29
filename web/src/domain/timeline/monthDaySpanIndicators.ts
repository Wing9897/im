import type { TimelineItem } from "../../types";
import { addDays, isSameDay, startOfDay } from "./dateUtils";

export type MonthDaySpanCounts = {
  /** Started before this day and continues after it (middle of a multi-day span). */
  ongoing: number;
  /** Ends on this day and started on an earlier day (end of a multi-day span). */
  ending: number;
};

function eventBounds(event: TimelineItem): { start: Date; end: Date } {
  const start = new Date(event.startTime);
  const end = event.endTime ? new Date(event.endTime) : start;
  return { start, end: end < start ? start : end };
}

/**
 * Calendar end day for span classification.
 * Midnight-exact ends are treated as exclusive (last active day = previous day),
 * matching common all-day / range conventions.
 */
function effectiveEndDay(start: Date, end: Date): Date {
  const endDay = startOfDay(end);
  if (end.getTime() === endDay.getTime() && end > start) {
    return addDays(endDay, -1);
  }
  return endDay;
}

/**
 * Classify a multi-day event relative to `day` for month-cell compact counters.
 * Start day and single-day events are excluded (chips already cover the start).
 */
export function classifyMonthDaySpan(
  event: TimelineItem,
  day: Date,
): "ongoing" | "ending" | null {
  const { start, end } = eventBounds(event);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const dayStart = startOfDay(day);
  const startDay = startOfDay(start);
  const endDay = effectiveEndDay(start, end);

  if (isSameDay(startDay, endDay)) return null;
  if (isSameDay(startDay, dayStart)) return null;

  if (isSameDay(endDay, dayStart)) return "ending";
  if (dayStart > startDay && dayStart < endDay) return "ongoing";
  return null;
}

/** Count ongoing / ending span indicators for a month day cell. */
export function countMonthDaySpanIndicators(
  events: TimelineItem[],
  day: Date,
): MonthDaySpanCounts {
  let ongoing = 0;
  let ending = 0;
  for (const event of events) {
    const kind = classifyMonthDaySpan(event, day);
    if (kind === "ongoing") ongoing += 1;
    else if (kind === "ending") ending += 1;
  }
  return { ongoing, ending };
}

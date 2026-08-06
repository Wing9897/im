import type { TimelineItem } from "../../types";
import {
  effectiveEndDay,
  eventStartsOnDay,
  isSameDay,
  startOfDay,
  timelineEventDateRange,
} from "./dateUtils";

export type MonthDaySpanCounts = {
  /** Started before this day and continues after it (middle of a multi-day span). */
  ongoing: number;
  /** Ends on this day and started on an earlier day (end of a multi-day span). */
  ending: number;
};

function eventBounds(event: TimelineItem): { start: Date; end: Date } {
  const { start, end } = timelineEventDateRange(event);
  return { start, end: end < start ? start : end };
}

/** Single-day markers that still feed month-cell「+N 结束」. */
function isEndingMarkerOnDay(event: TimelineItem, dayStart: Date): boolean {
  if (!eventStartsOnDay(event, dayStart)) return false;
  if (event.source === "item" && event.itemDateKind === "expires") return true;
  if (event.source === "recurring" && event.isLastOccurrence) return true;
  return false;
}

/**
 * Classify a multi-day event relative to `day` for month-cell compact counters.
 * Start day and single-day events are excluded (chips already cover the start),
 * except item expiry and the final recurring occurrence which count as ending.
 */
export function classifyMonthDaySpan(
  event: TimelineItem,
  day: Date,
): "ongoing" | "ending" | null {
  const { start, end } = eventBounds(event);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;

  const dayStart = startOfDay(day);

  if (isEndingMarkerOnDay(event, dayStart)) return "ending";

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

/**
 * Month-cell titled preview rows: events that start on `day` and are NOT already
 * represented solely by「+N 进行中」／「+N 结束」chips.
 *
 * Cross-day middle/end and item expiry stay chip-only. Recurring finals still
 * appear as normal preview rows while also feeding the ending chip.
 */
export function eventShowsInMonthDayPreview(
  event: TimelineItem,
  day: Date,
): boolean {
  if (!eventStartsOnDay(event, day)) return false;
  const span = classifyMonthDaySpan(event, day);
  if (span === null) return true;
  // Recurring is non-continuous: final occurrence stays in the normal list.
  if (
    span === "ending" &&
    event.source === "recurring" &&
    event.isLastOccurrence
  ) {
    return true;
  }
  return false;
}

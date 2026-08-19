/**
 * Manage-list filters for /schedule (type · workset · inclusive date range).
 */

import type { UserEvent } from "../../api/userEvents";
import type { ScheduleListEntry } from "./scheduleList";
import type { ScheduleRecurringItem } from "./useScheduleRecurringFeed";

export type ScheduleTypeFilter = "all" | "oneOff" | "recurring";

export type ScheduleListFilters = {
  type: ScheduleTypeFilter;
  worksetId: string;
  startDay: string;
  endDay: string;
};

export const DEFAULT_SCHEDULE_FILTERS: ScheduleListFilters = {
  type: "all",
  worksetId: "",
  startDay: "",
  endDay: "",
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isScheduleDayInput(value: string): boolean {
  const day = value.trim();
  if (!DAY_RE.test(day)) return false;
  const [year, month, date] = day.split("-").map(Number);
  const parsed = new Date(year, month - 1, date);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === date
  );
}

export function normalizeScheduleFilters(raw: unknown): ScheduleListFilters {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_SCHEDULE_FILTERS };
  const row = raw as Record<string, unknown>;
  const type = row.type;
  return {
    type: type === "oneOff" || type === "recurring" || type === "all" ? type : "all",
    worksetId: typeof row.worksetId === "string" ? row.worksetId.trim() : "",
    startDay: typeof row.startDay === "string" && isScheduleDayInput(row.startDay) ? row.startDay : "",
    endDay: typeof row.endDay === "string" && isScheduleDayInput(row.endDay) ? row.endDay : "",
  };
}

/** Distinct active dimensions (type · workset · date range) for the toolbar badge. */
export function countActiveScheduleFilters(filters: ScheduleListFilters): number {
  return (
    Number(filters.type !== "all") +
    Number(Boolean(filters.worksetId)) +
    Number(Boolean(filters.startDay || filters.endDay))
  );
}

export function scheduleFiltersAreActive(filters: ScheduleListFilters): boolean {
  return countActiveScheduleFilters(filters) > 0;
}

function orderedRange(startDay: string, endDay: string): { startDay: string; endDay: string } {
  if (startDay && endDay && startDay > endDay) {
    return { startDay: endDay, endDay: startDay };
  }
  return { startDay, endDay };
}

/** ISO window for `listUserEventsPage({ start, end })` (local day bounds). */
export function scheduleDateQueryWindow(
  startDay: string,
  endDay: string,
): { start?: string; end?: string } {
  const range = orderedRange(startDay.trim(), endDay.trim());
  const out: { start?: string; end?: string } = {};
  if (isScheduleDayInput(range.startDay)) {
    const startMs = Date.parse(`${range.startDay}T00:00:00`);
    out.start = Number.isFinite(startMs) ? new Date(startMs).toISOString() : `${range.startDay}T00:00:00`;
  }
  if (isScheduleDayInput(range.endDay)) {
    const endMs = Date.parse(`${range.endDay}T23:59:59.999`);
    out.end = Number.isFinite(endMs) ? new Date(endMs).toISOString() : `${range.endDay}T23:59:59.999`;
  }
  return out;
}

function dayFromIso(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(iso.trim());
  return match?.[1] ?? null;
}

function rangesOverlap(
  seriesStart: string,
  seriesEnd: string,
  rangeStart: string,
  rangeEnd: string,
): boolean {
  return seriesStart <= rangeEnd && seriesEnd >= rangeStart;
}

/** Recurring series with no list-API date params — overlap dtstart..dtend (open-ended if no end). */
export function recurringSeriesInDateRange(
  series: ScheduleRecurringItem,
  startDay: string,
  endDay: string,
): boolean {
  if (!startDay && !endDay) return true;
  const range = orderedRange(startDay, endDay);
  const rangeStart = range.startDay || "0000-01-01";
  const rangeEnd = range.endDay || "9999-12-31";
  const seriesStart =
    dayFromIso(series.eventStartTime) || dayFromIso(series.createdAt) || "0000-01-01";
  const seriesEnd = dayFromIso(series.eventEndTime) || "9999-12-31";
  return rangesOverlap(seriesStart, seriesEnd, rangeStart, rangeEnd);
}

export function userEventInDateRange(event: UserEvent, startDay: string, endDay: string): boolean {
  if (!startDay && !endDay) return true;
  const range = orderedRange(startDay, endDay);
  const rangeStart = range.startDay || "0000-01-01";
  const rangeEnd = range.endDay || "9999-12-31";
  const eventStart = dayFromIso(event.startTime) || dayFromIso(event.createdAt) || "0000-01-01";
  const eventEnd = dayFromIso(event.endTime) || eventStart;
  return rangesOverlap(eventStart, eventEnd, rangeStart, rangeEnd);
}

/** Client-side date filter for recurring rows (one-offs already use list `start`/`end`). */
export function filterScheduleEntriesByDate(
  entries: readonly ScheduleListEntry[],
  startDay: string,
  endDay: string,
): ScheduleListEntry[] {
  if (!startDay && !endDay) return [...entries];
  return entries.filter((entry) =>
    entry.kind === "oneOff"
      ? userEventInDateRange(entry.event, startDay, endDay)
      : recurringSeriesInDateRange(entry.series, startDay, endDay),
  );
}

export { scheduleEmojiStorageKey } from "../../domain/schedule/scheduleEmoji";

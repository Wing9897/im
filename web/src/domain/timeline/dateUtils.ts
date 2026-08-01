import type { TimelineItem } from "../../types";
import { getDateTimeLocale } from "../../i18n/locale";
import { formatOsDateTime } from "../../utils/time";

export type TimelineScale = "day" | "week" | "month" | "quarter" | "year";

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfWeek(date: Date): Date {
  const normalized = startOfDay(date);
  const day = (normalized.getDay() + 6) % 7;
  normalized.setDate(normalized.getDate() - day);
  return normalized;
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addDays(date: Date, delta: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + delta);
  return next;
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export function startOfQuarter(date: Date): Date {
  const month = date.getMonth();
  const quarterStartMonth = Math.floor(month / 3) * 3;
  return new Date(date.getFullYear(), quarterStartMonth, 1);
}

export function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

export function addQuarters(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta * 3, 1);
}

export function addYears(date: Date, delta: number): Date {
  return new Date(date.getFullYear() + delta, date.getMonth(), 1);
}

export function getQuarterNumber(date: Date): number {
  return Math.floor(date.getMonth() / 3) + 1;
}

export function buildQuarterWeeks(quarterStart: Date): Date[] {
  const quarterEnd = addQuarters(quarterStart, 1);
  const weeks: Date[] = [];
  let current = startOfWeek(quarterStart);
  if (current < quarterStart) {
    current = addDays(current, 7);
  }
  while (current < quarterEnd) {
    weeks.push(new Date(current));
    current = addDays(current, 7);
  }
  return weeks;
}

function formatMonthLabel(date: Date) {
  return date.toLocaleDateString(getDateTimeLocale(), {
    year: "numeric",
    month: "long",
  });
}

function formatDayLabel(date: Date) {
  return formatOsDateTime(date.toISOString(), {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}

function formatWeekLabel(date: Date) {
  const weekStart = startOfWeek(date);
  const weekEnd = addDays(weekStart, 6);
  return `${formatDayLabel(weekStart)} - ${formatDayLabel(weekEnd)}`;
}

export function formatRangeLabel(scale: TimelineScale, cursor: Date): string {
  if (scale === "day") return formatDayLabel(cursor);
  if (scale === "week") return formatWeekLabel(cursor);
  if (scale === "quarter") {
    // Quarter index stays numeric/Latin ("2024 Q2") across locales.
    return `${cursor.getFullYear()} Q${getQuarterNumber(cursor)}`;
  }
  if (scale === "year") {
    return cursor.toLocaleDateString(getDateTimeLocale(), { year: "numeric" });
  }
  return formatMonthLabel(cursor);
}

function parseAllDayWallDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return new Date(value);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/**
 * Convert a timeline event to browser display dates.
 * Timed instants use normal UTC→system-zone conversion. All-day values retain
 * their RFC calendar date instead of shifting into the previous/next local day.
 */
export function timelineEventDateRange(event: TimelineItem) {
  const parse = event.isAllDay ? parseAllDayWallDate : (value: string) => new Date(value);
  const start = parse(event.startTime);
  const end = event.endTime ? parse(event.endTime) : start;
  return { start, end };
}

export function eventOverlapsRange(
  event: TimelineItem,
  rangeStart: Date,
  rangeEnd: Date,
) {
  const { start, end } = timelineEventDateRange(event);
  return start < rangeEnd && end >= rangeStart;
}

export function eventStartsOnDay(event: TimelineItem, day: Date): boolean {
  const { start } = timelineEventDateRange(event);
  return start >= day && start < addDays(day, 1);
}

export function buildCalendarDays(month: Date): Date[] {
  const firstDay = startOfMonth(month);
  // Sunday-first grid (0 = Sunday … 6 = Saturday), matching common calendar UIs.
  const startOffset = firstDay.getDay();
  const gridStart = new Date(firstDay);
  gridStart.setDate(firstDay.getDate() - startOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
}

export function buildWeekDays(cursor: Date): Date[] {
  const weekStart = startOfWeek(cursor);
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

export function isSameDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

export function formatWeekdayLabel(date: Date): string {
  return formatOsDateTime(date.toISOString(), {
    weekday: "short",
    month: "numeric",
    day: "numeric",
  });
}

export function formatTimeLabel(date: Date): string {
  return date.toLocaleTimeString(getDateTimeLocale(), {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function toDateTimeLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  const hour = String(parsed.getHours()).padStart(2, "0");
  const minute = String(parsed.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function fromDateTimeLocalInput(value: string): string | null {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

export type GanttColumn = {
  key: string;
  label: string;
  day?: Date;
};

/** Twelve month columns for year-scale Gantt views. */
export function buildYearGanttColumns(timeCursor: Date): GanttColumn[] {
  const yearStart = startOfYear(timeCursor);
  const locale = getDateTimeLocale();
  return Array.from({ length: 12 }, (_, i) => {
    const monthDate = new Date(yearStart.getFullYear(), i, 1);
    return {
      key: monthDate.toISOString(),
      label: monthDate.toLocaleDateString(locale, { month: "short" }),
      day: monthDate,
    };
  });
}

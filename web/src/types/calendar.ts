// ============================================================
// Calendar / Recurring Event Type Definitions
// ============================================================

/** Recurrence frequency (RFC 5545 FREQ) supported by recurring mode */
export type RecurrenceFreq = "daily" | "weekly" | "monthly" | "yearly";

/** Day-of-week code used by RRULE BYDAY (without ordinal prefix) */
export type WeekdayCode = "MO" | "TU" | "WE" | "TH" | "FR" | "SA" | "SU";

/** End condition for a recurrence rule */
export type RecurrenceEndType = "never" | "until" | "count";

/** End condition for a recurrence rule (mutually exclusive UNTIL/COUNT per RFC 5545) */
export interface RecurrenceEnd {
  type: RecurrenceEndType;
  /** UTC datetime (RFC 3339) the recurrence runs until; set when type is "until" */
  until?: string | null;
  /** Number of occurrences after which the recurrence stops; set when type is "count" */
  count?: number | null;
}

/**
 * Structured recurrence configuration backing the visual recurrence editor.
 * Serialized to / parsed from an RFC 5545 RRULE string by `utils/rrule.ts`.
 */
export interface RecurrenceConfig {
  /** Recurrence frequency (FREQ) */
  freq: RecurrenceFreq;
  /** Interval between occurrences (INTERVAL), 1–999 */
  interval: number;
  /** Specific days of the week (BYDAY) */
  byDay: WeekdayCode[];
  /** Specific days of the month (BYMONTHDAY), −31..−1 / 1..31 */
  byMonthDay: number[];
  /** Specific months (BYMONTH), 1–12 */
  byMonth: number[];
  /** Ordinal for day-of-week selections (e.g., -1 for "last", 1 for "first") */
  ordinal?: number | null;
  /** End condition (never / until / count) */
  end: RecurrenceEnd;
}

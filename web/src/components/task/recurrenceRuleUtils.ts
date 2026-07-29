// ============================================================
// Recurrence Rule Editor — utility functions
// ============================================================
//
// Extracted helper functions used by the RecurrenceRuleEditor and its
// sub-components. These are pure functions with no React dependencies.

import { buildRRule, parseRRule } from "../../utils/rrule";
import type { RecurrenceConfig } from "../../types/calendar";

// ── Default configuration ─────────────────────────────────────────────────────

const DEFAULT_CONFIG: RecurrenceConfig = {
  freq: "daily",
  interval: 1,
  byDay: [],
  byMonthDay: [],
  byMonth: [],
  ordinal: null,
  end: { type: "never", until: null, count: null },
};

// ── Monthly mode type ─────────────────────────────────────────────────────────

export type MonthlyMode = "monthday" | "weekday";

// ── Helper functions ──────────────────────────────────────────────────────────

/** Parse an incoming value (string RRULE or config object) into a RecurrenceConfig. */
export function toConfig(value: string | RecurrenceConfig): RecurrenceConfig {
  if (typeof value === "string") {
    return value.trim().length > 0 ? parseRRule(value) : { ...DEFAULT_CONFIG };
  }
  return value;
}

/** A stable string key for an incoming value, used to detect external changes. */
export function valueKey(value: string | RecurrenceConfig): string {
  return typeof value === "string" ? value : buildRRule(value);
}

/** Extract the YYYY-MM-DD part of an RFC 3339 UTC datetime for a date input. */
export function untilToDateInput(until?: string | null): string {
  if (!until) return "";
  const m = until.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

/** Combine a YYYY-MM-DD date-input value with end-of-day into an RFC 3339 UTC string. */
export function dateInputToUntil(date: string): string | null {
  return date ? `${date}T23:59:59Z` : null;
}

/** A default UNTIL one year from today (end of day, UTC). */
export function defaultUntil(): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T23:59:59Z`;
}

/** Order BYMONTHDAY values with positives ascending and negatives last. */
export function sortMonthDays(days: number[]): number[] {
  return [...days].sort((a, b) => (a < 0 ? 1000 - a : a) - (b < 0 ? 1000 - b : b));
}

/** Derive the monthly mode from the current config state. */
export function deriveMonthlyMode(config: RecurrenceConfig): MonthlyMode {
  return config.ordinal != null && config.byDay.length > 0 ? "weekday" : "monthday";
}

// ============================================================
// RRULE (RFC 5545) build / parse utilities
// ============================================================
//
// Serializes the structured `RecurrenceConfig` backing the visual recurrence
// editor to an RFC 5545 RRULE string and parses it back. The two functions form
// a round-trip pair (Requirement 8.4): `parseRRule(buildRRule(config))` yields a
// configuration equivalent to the original.
//
// Supported components: FREQ, INTERVAL, BYDAY (with optional ordinal prefix such
// as `-1FR`), BYMONTHDAY, BYMONTH, and the end condition (UNTIL / COUNT / none).

import type {
  RecurrenceConfig,
  RecurrenceEnd,
  RecurrenceFreq,
  WeekdayCode,
} from "../../types/calendar";

// ── Constant maps ─────────────────────────────────────

const FREQ_TO_RRULE: Record<RecurrenceFreq, string> = {
  daily: "DAILY",
  weekly: "WEEKLY",
  monthly: "MONTHLY",
  yearly: "YEARLY",
};

const RRULE_TO_FREQ: Record<string, RecurrenceFreq> = {
  DAILY: "daily",
  WEEKLY: "weekly",
  MONTHLY: "monthly",
  YEARLY: "yearly",
};

const WEEKDAY_CODES: readonly WeekdayCode[] = [
  "MO",
  "TU",
  "WE",
  "TH",
  "FR",
  "SA",
  "SU",
];

// Matches a single BYDAY token: an optional signed ordinal prefix followed by a
// two-letter weekday code, e.g. "MO", "2MO", "+2MO", "-1FR".
const BYDAY_TOKEN = /^([+-]?\d+)?(MO|TU|WE|TH|FR|SA|SU)$/;

// Matches an RFC 5545 basic-format UTC datetime, e.g. "20251231T235959Z".
const RRULE_UNTIL = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/;

// ── UNTIL datetime conversions ────────────────────────

/**
 * Converts an RFC 3339 UTC datetime (e.g. "2025-12-31T23:59:59Z") into the
 * RFC 5545 RRULE basic UTC format (e.g. "20251231T235959Z"). UNTIL has
 * second precision, so any fractional seconds are dropped.
 */
function rfc3339ToRruleUntil(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    // Fallback: strip the RFC 3339 separators and any fractional seconds.
    return value.replace(/\.\d+/, "").replace(/[-:]/g, "");
  }
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

/**
 * Converts an RFC 5545 RRULE basic UTC datetime (e.g. "20251231T235959Z") back
 * into a canonical RFC 3339 UTC datetime (e.g. "2025-12-31T23:59:59Z").
 */
function rruleUntilToRfc3339(value: string): string {
  const m = value.match(RRULE_UNTIL);
  if (m) {
    return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`;
  }
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString().replace(/\.\d+Z$/, "Z");
  }
  return value;
}

// ── buildRRule ────────────────────────────────────────

/**
 * Serializes a {@link RecurrenceConfig} into an RFC 5545 RRULE string.
 *
 * Component order: FREQ, INTERVAL, BYDAY, BYMONTHDAY, BYMONTH, then the end
 * condition (UNTIL or COUNT). INTERVAL is omitted when it equals 1 (the RFC
 * default). When `ordinal` is set and `byDay` is non-empty, each BYDAY entry is
 * prefixed with the ordinal (e.g. "-1FR").
 */
export function buildRRule(config: RecurrenceConfig): string {
  const parts: string[] = [];

  parts.push(`FREQ=${FREQ_TO_RRULE[config.freq]}`);

  if (config.interval != null && config.interval !== 1) {
    parts.push(`INTERVAL=${config.interval}`);
  }

  if (config.byDay.length > 0) {
    const hasOrdinal = config.ordinal != null;
    const days = config.byDay.map((day) =>
      hasOrdinal ? `${config.ordinal}${day}` : day,
    );
    parts.push(`BYDAY=${days.join(",")}`);
  }

  if (config.byMonthDay.length > 0) {
    parts.push(`BYMONTHDAY=${config.byMonthDay.join(",")}`);
  }

  if (config.byMonth.length > 0) {
    parts.push(`BYMONTH=${config.byMonth.join(",")}`);
  }

  if (config.end.type === "until" && config.end.until != null) {
    parts.push(`UNTIL=${rfc3339ToRruleUntil(config.end.until)}`);
  } else if (config.end.type === "count" && config.end.count != null) {
    parts.push(`COUNT=${config.end.count}`);
  }

  return parts.join(";");
}

// ── parseRRule ────────────────────────────────────────

/** Parses a comma-separated numeric list (e.g. "15,-1") into numbers. */
function parseNumberList(value: string): number[] {
  return value
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .map((token) => Number.parseInt(token, 10))
    .filter((n) => !Number.isNaN(n));
}

/**
 * Parses an RFC 5545 RRULE string into a {@link RecurrenceConfig}. This is the
 * inverse of {@link buildRRule}: missing components fall back to their RFC
 * defaults (INTERVAL=1, empty BY* lists, end type "never").
 *
 * The optional "RRULE:" prefix is rejected. Component keys are matched
 * case-insensitively; weekday codes and FREQ values are normalized.
 */
export function parseRRule(rrule: string): RecurrenceConfig {
  const trimmed = rrule.trim();
  if (/^RRULE:/i.test(trimmed)) {
    throw new Error("RRULE must not include an 'RRULE:' prefix");
  }
  const body = trimmed;

  const fields = new Map<string, string>();
  for (const segment of body.split(";")) {
    const idx = segment.indexOf("=");
    if (idx === -1) continue;
    const key = segment.slice(0, idx).trim().toUpperCase();
    const value = segment.slice(idx + 1).trim();
    if (key.length > 0) {
      fields.set(key, value);
    }
  }

  const freqRaw = (fields.get("FREQ") ?? "").toUpperCase();
  const freq: RecurrenceFreq = RRULE_TO_FREQ[freqRaw] ?? "daily";

  const intervalRaw = fields.get("INTERVAL");
  const intervalParsed =
    intervalRaw != null ? Number.parseInt(intervalRaw, 10) : NaN;
  const interval = Number.isNaN(intervalParsed) ? 1 : intervalParsed;

  const byDay: WeekdayCode[] = [];
  let ordinal: number | null = null;
  const byDayRaw = fields.get("BYDAY");
  if (byDayRaw != null && byDayRaw.length > 0) {
    for (const token of byDayRaw.split(",")) {
      const m = token.trim().toUpperCase().match(BYDAY_TOKEN);
      if (!m) continue;
      if (m[1] != null) {
        const parsedOrdinal = Number.parseInt(m[1], 10);
        if (!Number.isNaN(parsedOrdinal)) {
          ordinal = parsedOrdinal;
        }
      }
      byDay.push(m[2] as WeekdayCode);
    }
  }

  const byMonthDay = parseNumberList(fields.get("BYMONTHDAY") ?? "");
  const byMonth = parseNumberList(fields.get("BYMONTH") ?? "");

  let end: RecurrenceEnd;
  const untilRaw = fields.get("UNTIL");
  const countRaw = fields.get("COUNT");
  if (untilRaw != null && untilRaw.length > 0) {
    end = { type: "until", until: rruleUntilToRfc3339(untilRaw), count: null };
  } else if (countRaw != null && countRaw.length > 0) {
    const count = Number.parseInt(countRaw, 10);
    end = {
      type: "count",
      until: null,
      count: Number.isNaN(count) ? null : count,
    };
  } else {
    end = { type: "never", until: null, count: null };
  }

  return { freq, interval, byDay, byMonthDay, byMonth, ordinal, end };
}

/** All supported weekday codes, exported for editor controls and tests. */
export { WEEKDAY_CODES };

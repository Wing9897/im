import { getDateTimeLocale } from "../i18n/locale";

function normalizeTimestamp(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(trimmed);
  if (hasTimezone) return trimmed;

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmed)) {
    return `${trimmed.replace(" ", "T")}Z`;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmed)) {
    return `${trimmed}Z`;
  }

  return trimmed;
}

function parseOsTime(value: string): Date {
  return new Date(normalizeTimestamp(value));
}

/** Formats an OS-originated timestamp string to a locale-aware date/time string. */
export function formatOsDateTime(
  value: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!value) return "";
  const parsed = parseOsTime(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(getDateTimeLocale(), options);
}

/** Like `formatOsDateTime` but returns a fallback string for null/undefined values. */
export function formatOptionalOsDateTime(
  value: string | null | undefined,
  options?: Intl.DateTimeFormatOptions,
  fallback = "—",
): string {
  if (!value) return fallback;
  return formatOsDateTime(value, options);
}

/** Parses an OS-originated timestamp string and returns its epoch milliseconds. */
export function getOsTimeMs(value: string | null | undefined): number {
  if (!value) return NaN;
  return parseOsTime(value).getTime();
}

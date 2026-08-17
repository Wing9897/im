/**
 * Fired-key state transitions: dedupe identity, prune, quiet-hours gate.
 */

import {
  FIRED_RETAIN_AFTER_START_MS,
} from "./scannerTypes";

/**
 * Dedupe key: ``eventId::lead::startTime`` (matches server prune).
 * ``startTime`` may contain ``:``; always split on the first two ``::``.
 */
export function buildDedupeKey(
  eventId: string,
  leadOffsetMinutes: number,
  startTime: string,
): string {
  return `${eventId}::${leadOffsetMinutes}::${startTime}`;
}

/** True when a local clock time falls inside an overnight-aware quiet period. */
export function isWithinQuietHours(
  now: Date,
  quietHours: { start: string; end: string },
): boolean {
  const toMinutes = (value: string): number | null => {
    const match = /^(\d{2}):(\d{2})$/.exec(value);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    return hours <= 23 && minutes <= 59 ? hours * 60 + minutes : null;
  };
  const start = toMinutes(quietHours.start);
  const end = toMinutes(quietHours.end);
  if (start === null || end === null || start === end) {
    return false;
  }
  const current = now.getHours() * 60 + now.getMinutes();
  return start < end
    ? current >= start && current < end
    : current >= start || current < end;
}

/** Parse startTime ISO from a dedupe key; null if malformed. */
export function parseStartTimeFromDedupeKey(key: string): string | null {
  const firstSep = key.indexOf("::");
  if (firstSep < 0) {
    return null;
  }
  const secondSep = key.indexOf("::", firstSep + 2);
  if (secondSep < 0) {
    return null;
  }
  const startTime = key.slice(secondSep + 2);
  return startTime || null;
}

/** Drop fired keys whose event start is older than retain window. */
export function pruneFiredKeys(
  firedKeys: ReadonlySet<string>,
  nowMs: number,
  retainAfterStartMs: number = FIRED_RETAIN_AFTER_START_MS,
): Set<string> {
  const next = new Set<string>();
  for (const key of firedKeys) {
    const startTime = parseStartTimeFromDedupeKey(key);
    if (!startTime) {
      continue;
    }
    const startMs = Date.parse(startTime);
    if (!Number.isFinite(startMs)) {
      continue;
    }
    if (startMs + retainAfterStartMs >= nowMs) {
      next.add(key);
    }
  }
  return next;
}

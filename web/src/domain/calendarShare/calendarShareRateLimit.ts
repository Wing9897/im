/**
 * In-memory per-action cooldown for calendar-share / subscriptions.
 * Sliding window: `burst` attempts per `windowMs` for each family.
 */

export const CALENDAR_SHARE_RATE_LIMIT_WINDOW_MS = 1000;

export type CalendarShareActionFamily =
  | "search"
  | "subscribe"
  | "unsubscribe"
  | "publish"
  | "catalog"
  | "publishList";

/** Search allows recommended-on-mount plus one user submit in the same window. */
const BURST: Record<CalendarShareActionFamily, number> = {
  search: 2,
  subscribe: 1,
  unsubscribe: 1,
  publish: 2,
  catalog: 3,
  publishList: 5,
};

const stamps = new Map<CalendarShareActionFamily, number[]>();

export class CalendarShareRateLimitError extends Error {
  readonly family: CalendarShareActionFamily;

  constructor(family: CalendarShareActionFamily) {
    super("RATE_LIMITED");
    this.name = "CalendarShareRateLimitError";
    this.family = family;
  }
}

export function consumeCalendarShareRateLimit(
  family: CalendarShareActionFamily,
  now = Date.now(),
): void {
  const burst = BURST[family];
  const prev = (stamps.get(family) ?? []).filter((stamp) => now - stamp < CALENDAR_SHARE_RATE_LIMIT_WINDOW_MS);
  if (prev.length >= burst) {
    throw new CalendarShareRateLimitError(family);
  }
  prev.push(now);
  stamps.set(family, prev);
}

/** Test-only: clear sliding windows. */
export function resetCalendarShareRateLimitForTests(): void {
  stamps.clear();
}

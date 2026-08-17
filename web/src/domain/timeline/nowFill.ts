import { todayDateInput } from "./dateUtils";

/** Local ``HH:MM`` for ``<input type="time">``. */
export function localClockInput(now: Date = new Date()): string {
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

/** Local ``YYYY-MM-DDTHH:MM`` for ``<input type="datetime-local">``. */
export function localDateTimeInput(now: Date = new Date()): string {
  return `${todayDateInput(now)}T${localClockInput(now)}`;
}

/**
 * Fill start/end from the local clock.
 * All-day → today's date only. Timed → now and now+1h (same span as create defaults).
 * ``clockOnly`` is HH:MM for recurring series (no calendar date in the form).
 */
export function fillNowRange(args: {
  isAllDay: boolean;
  clockOnly?: boolean;
  now?: Date;
}): { start: string; end: string } {
  const now = args.now ?? new Date();
  if (args.isAllDay) {
    const day = todayDateInput(now);
    return { start: day, end: day };
  }
  const later = new Date(now.getTime() + 60 * 60 * 1000);
  if (args.clockOnly) {
    return { start: localClockInput(now), end: localClockInput(later) };
  }
  return { start: localDateTimeInput(now), end: localDateTimeInput(later) };
}

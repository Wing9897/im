/**
 * Map UserEventDialog form fields when switching one_off ↔ recurring.
 *
 * Field shapes differ (datetime-local / date vs HH:MM clocks). Preserve the
 * user's date + clock intent across toggles; only fall back to ``today`` when
 * no date was ever chosen.
 */

import { datePartFromInput, todayDateInput } from "./dateUtils";

export type UserEventKind = "one_off" | "recurring";

export type KindSwitchFormSlice = {
  kind: UserEventKind;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  rrule: string;
  eventStartTime: string;
  eventEndTime: string;
};

const CLOCK_RE = /^\d{2}:\d{2}$/;

function clockFromDateTimeLocal(value: string): string {
  if (!value.includes("T")) return "";
  const clock = value.slice(11, 16);
  return CLOCK_RE.test(clock) ? clock : "";
}

/** True when end clock is earlier than start (e.g. 22:00 → 06:00). */
export function isOvernightClockRange(startClock: string, endClock: string): boolean {
  const start = startClock.trim();
  const end = endClock.trim();
  return CLOCK_RE.test(start) && CLOCK_RE.test(end) && end < start;
}

export function valuesForKindChange<T extends KindSwitchFormSlice>(
  prev: T,
  nextKind: UserEventKind,
  options: { defaultRrule: string; today?: string },
): T {
  const today = options.today ?? todayDateInput();
  const defaultRrule = options.defaultRrule;
  if (nextKind === prev.kind) return prev;

  if (nextKind === "recurring") {
    const clockFromStart = clockFromDateTimeLocal(prev.startTime);
    const clockFromEnd = clockFromDateTimeLocal(prev.endTime);
    return {
      ...prev,
      kind: "recurring",
      rrule: prev.rrule.trim() || defaultRrule,
      eventStartTime: clockFromStart || prev.eventStartTime || "09:00",
      eventEndTime: clockFromEnd || prev.eventEndTime || "10:00",
      // Keep startTime/endTime so switching back can restore the calendar date.
    };
  }

  const startDate = datePartFromInput(prev.startTime) || today;
  const endDateRaw = datePartFromInput(prev.endTime) || startDate;
  const endDate = endDateRaw < startDate ? startDate : endDateRaw;
  const startClock = CLOCK_RE.test(prev.eventStartTime.trim())
    ? prev.eventStartTime.trim()
    : "09:00";
  const endClock = CLOCK_RE.test(prev.eventEndTime.trim())
    ? prev.eventEndTime.trim()
    : "10:00";

  if (prev.isAllDay) {
    return {
      ...prev,
      kind: "one_off",
      startTime: startDate,
      endTime: endDate,
    };
  }

  return {
    ...prev,
    kind: "one_off",
    startTime: `${startDate}T${startClock}`,
    endTime: `${endDate}T${endClock}`,
  };
}

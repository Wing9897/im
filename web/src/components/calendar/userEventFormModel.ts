import { toUserEventFormWorksetId } from "../../domain/timeline/userEvents";
import {
  inclusiveEndDateFromExclusive,
  toAllDayDateInput,
  toDateTimeLocalInput,
} from "../../domain/timeline/dateUtils";
import type { UserEventKind } from "../../domain/timeline/userEventKindSwitch";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { buildRRule } from "../../utils/rrule";

export type { UserEventKind };

export type UserEventFormValues = {
  /** Create-dialog kind; edit / import paths always submit ``one_off``. */
  kind: UserEventKind;
  title: string;
  /** One-off: ISO wire datetime (or all-day DATE start). Recurring: unused. */
  startTime: string;
  /** One-off: ISO wire datetime / exclusive all-day end. Recurring: unused. */
  endTime: string;
  location: string;
  body: string;
  /** Ownership workset id (``__user__`` = builtin system workset). */
  worksetId: string;
  isAllDay: boolean;
  /** RRULE when ``kind === "recurring"``. */
  rrule: string;
  /** HH:MM when recurring and not all-day. */
  eventStartTime: string;
  eventEndTime: string;
};

export type UserEventTaskOption = {
  id: string;
  name: string;
};

export const DEFAULT_RRULE = buildRRule({
  freq: "daily",
  interval: 1,
  byDay: [],
  byMonthDay: [],
  byMonth: [],
  ordinal: null,
  end: { type: "never", until: null, count: null },
});

export const EMPTY_USER_EVENT_FORM: UserEventFormValues = {
  kind: "one_off",
  title: "",
  startTime: "",
  endTime: "",
  location: "",
  body: "",
  worksetId: SYSTEM_WORKSET_ID,
  isAllDay: false,
  rrule: DEFAULT_RRULE,
  eventStartTime: "09:00",
  eventEndTime: "10:00",
};

export const USER_EVENT_DAY_PRESETS = [1, 3, 7, 13] as const;
export const USER_EVENT_CLOCK_RE = /^\d{2}:\d{2}$/;

export function valuesFromInitial(
  initial?: Partial<UserEventFormValues> | null,
): UserEventFormValues {
  const isAllDay = Boolean(initial?.isAllDay);
  const kind: UserEventKind = initial?.kind === "recurring" ? "recurring" : "one_off";
  const base = {
    kind,
    title: initial?.title ?? "",
    location: initial?.location ?? "",
    body: initial?.body ?? "",
    worksetId: toUserEventFormWorksetId(initial?.worksetId),
    isAllDay,
    rrule: (initial?.rrule ?? "").trim() || DEFAULT_RRULE,
    eventStartTime: (initial?.eventStartTime ?? "").trim() || "09:00",
    eventEndTime: (initial?.eventEndTime ?? "").trim() || "10:00",
  };

  if (kind === "recurring") {
    return {
      ...base,
      startTime: "",
      endTime: "",
    };
  }

  if (isAllDay) {
    const startDate = toAllDayDateInput(initial?.startTime ?? "");
    const exclusiveEnd = toAllDayDateInput(initial?.endTime ?? "");
    const endDate =
      (exclusiveEnd ? inclusiveEndDateFromExclusive(exclusiveEnd) : "") || startDate;
    return {
      ...base,
      startTime: startDate,
      endTime: endDate,
    };
  }
  return {
    ...base,
    startTime: toDateTimeLocalInput(initial?.startTime ?? ""),
    endTime: toDateTimeLocalInput(initial?.endTime ?? ""),
  };
}

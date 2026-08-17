import { toUserEventFormWorksetId } from "../../domain/timeline/userEvents";
import {
  addDaysToDateInput,
  datePartFromInput,
  fromAllDayDateInput,
  fromDateTimeLocalInput,
} from "../../domain/timeline/dateUtils";
import { parseRRule } from "../../domain/schedule/rrule";
import { validateRRuleConfig } from "../../domain/schedule/rruleValidation";
import {
  USER_EVENT_CLOCK_RE,
  type UserEventFormValues,
} from "../../domain/timeline/userEventFormModel";
import { normalizeNotifyPref } from "../../domain/notify/notifyPref";

export type UserEventFormSubmitResult =
  | { ok: true; values: UserEventFormValues }
  | { ok: false; errorKey: string; errorMessage?: string };

/**
 * Pure validate + wire-shape build for UserEventDialog submit.
 * Returns i18n keys (and optional inline message for RRULE field errors).
 */
export function buildUserEventSubmitValues(
  values: UserEventFormValues,
): UserEventFormSubmitResult {
  const title = values.title.trim();
  if (!title) {
    return { ok: false, errorKey: "userEvent.errors.titleRequired" };
  }

  if (values.kind === "recurring") {
    return buildRecurringSubmit(values, title);
  }
  if (values.isAllDay) {
    return buildOneOffAllDaySubmit(values, title);
  }
  return buildOneOffTimedSubmit(values, title);
}

function buildRecurringSubmit(
  values: UserEventFormValues,
  title: string,
): UserEventFormSubmitResult {
  const rrule = values.rrule.trim();
  if (!rrule) {
    return { ok: false, errorKey: "userEvent.errors.rruleRequired" };
  }
  try {
    const validation = validateRRuleConfig(parseRRule(rrule));
    if (!validation.valid || !validation.rruleString) {
      const message =
        validation.errors.byDay ||
        validation.errors.byMonthDay ||
        validation.errors.freq ||
        undefined;
      return {
        ok: false,
        errorKey: "userEvent.errors.rruleRequired",
        errorMessage: message,
      };
    }
  } catch {
    return { ok: false, errorKey: "userEvent.errors.rruleRequired" };
  }
  if (!values.isAllDay) {
    if (!USER_EVENT_CLOCK_RE.test(values.eventStartTime.trim())) {
      return { ok: false, errorKey: "userEvent.errors.startRequired" };
    }
    const endClock = values.eventEndTime.trim();
    if (endClock && !USER_EVENT_CLOCK_RE.test(endClock)) {
      return { ok: false, errorKey: "userEvent.errors.endInvalid" };
    }
  }
  return {
    ok: true,
    values: {
      kind: "recurring",
      calendarKind: values.calendarKind,
      title,
      startTime: "",
      endTime: "",
      location: values.location.trim(),
      body: values.body.trim(),
      worksetId: toUserEventFormWorksetId(values.worksetId),
      isAllDay: values.isAllDay,
      remindBeforeDays: values.remindBeforeDays.trim(),
      notifyPref: normalizeNotifyPref(values.notifyPref),
      itemId: values.itemId.trim(),
      amountInput: values.amountInput,
      direction: values.direction,
      rrule,
      eventStartTime: values.isAllDay ? "" : values.eventStartTime.trim(),
      eventEndTime: values.isAllDay ? "" : values.eventEndTime.trim(),
    },
  };
}

function buildOneOffAllDaySubmit(
  values: UserEventFormValues,
  title: string,
): UserEventFormSubmitResult {
  const startDate = datePartFromInput(values.startTime);
  if (!startDate) {
    return { ok: false, errorKey: "userEvent.errors.startRequired" };
  }
  let endDate = datePartFromInput(values.endTime) || startDate;
  if (endDate < startDate) endDate = startDate;
  const startTime = fromAllDayDateInput(startDate);
  const exclusiveEnd = fromAllDayDateInput(addDaysToDateInput(endDate, 1));
  if (!startTime || !exclusiveEnd) {
    return { ok: false, errorKey: "userEvent.errors.startInvalid" };
  }
  return {
    ok: true,
    values: {
      kind: "one_off",
      calendarKind: values.calendarKind,
      title,
      startTime,
      endTime: exclusiveEnd,
      location: values.location.trim(),
      body: values.body.trim(),
      worksetId: toUserEventFormWorksetId(values.worksetId),
      isAllDay: true,
      remindBeforeDays: values.remindBeforeDays.trim(),
      notifyPref: normalizeNotifyPref(values.notifyPref),
      itemId: values.itemId.trim(),
      amountInput: values.amountInput,
      direction: values.direction,
      rrule: "",
      eventStartTime: "",
      eventEndTime: "",
    },
  };
}

function buildOneOffTimedSubmit(
  values: UserEventFormValues,
  title: string,
): UserEventFormSubmitResult {
  const startTime = fromDateTimeLocalInput(values.startTime);
  if (!startTime) {
    return { ok: false, errorKey: "userEvent.errors.startRequired" };
  }
  const endTime = values.endTime ? fromDateTimeLocalInput(values.endTime) : "";
  if (values.endTime && !endTime) {
    return { ok: false, errorKey: "userEvent.errors.endInvalid" };
  }
  return {
    ok: true,
    values: {
      kind: "one_off",
      calendarKind: values.calendarKind,
      title,
      startTime,
      endTime: endTime || "",
      location: values.location.trim(),
      body: values.body.trim(),
      worksetId: toUserEventFormWorksetId(values.worksetId),
      isAllDay: false,
      remindBeforeDays: values.remindBeforeDays.trim(),
      notifyPref: normalizeNotifyPref(values.notifyPref),
      itemId: values.itemId.trim(),
      amountInput: values.amountInput,
      direction: values.direction,
      rrule: "",
      eventStartTime: "",
      eventEndTime: "",
    },
  };
}

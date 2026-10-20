/**
 * Standard user-event write for Timeline and Schedule.
 *
 * Create one-offs send ``kind: "normal"`` and omit amount / direction.
 * Updates omit ``kind`` and ``amount`` so special kinds and finance stay put.
 * Item-linked calendars do not use this path.
 *
 * Invalid remind is not displayed here. Callers show
 * ``timeline:userEvent.errors.remindInvalid`` and keep the dialog open.
 */

import { createUserEvent, updateUserEvent } from "../../api/userEvents";
import { createRecurringTimelineEvent } from "./createRecurringTimelineEvent";
import { parseRemindBeforeDays } from "./parseRemindBeforeDays";
import type { UserEventFormValues } from "./userEventFormModel";
import { toUserEventFormWorksetId } from "./userEvents";

export type StandardUserEventSubmitStatus =
  | "remindInvalid"
  | "recurringCreated"
  | "oneOffCreated"
  | "oneOffUpdated"
  | "skipped";

export async function submitStandardUserEvent(args: {
  mode: "create" | "edit";
  values: UserEventFormValues;
  editingEventId?: string | null;
}): Promise<StandardUserEventSubmitStatus> {
  const { mode, values } = args;
  const editingEventId = args.editingEventId ?? null;
  let remindBeforeDays: number | null;
  try {
    remindBeforeDays = parseRemindBeforeDays(values.remindBeforeDays);
  } catch {
    return "remindInvalid";
  }

  const worksetId = toUserEventFormWorksetId(values.worksetId);
  const itemId = (values.itemId ?? "").trim() || null;

  if (mode === "create" && values.kind === "recurring") {
    await createRecurringTimelineEvent({
      title: values.title,
      worksetId,
      isAllDay: values.isAllDay,
      eventStartTime: values.eventStartTime,
      eventEndTime: values.eventEndTime,
      location: values.location,
      body: values.body,
      rrule: values.rrule,
      itemId,
      notifyPref: values.notifyPref,
    });
    return "recurringCreated";
  }

  if (mode === "create") {
    await createUserEvent({
      title: values.title,
      startTime: values.startTime,
      endTime: values.endTime || null,
      body: values.body,
      location: values.location,
      isAllDay: values.isAllDay,
      remindBeforeDays,
      itemId,
      worksetId,
      kind: "normal",
      notifyPref: values.notifyPref,
    });
    return "oneOffCreated";
  }

  if (editingEventId) {
    await updateUserEvent(editingEventId, {
      title: values.title,
      startTime: values.startTime,
      endTime: values.endTime || null,
      body: values.body,
      location: values.location,
      isAllDay: values.isAllDay,
      remindBeforeDays,
      itemId,
      worksetId,
      // Omit kind/amount — preserve special kinds; title-only edits stay non-finance.
      notifyPref: values.notifyPref,
    });
    return "oneOffUpdated";
  }

  return "skipped";
}

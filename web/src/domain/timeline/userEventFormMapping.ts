/**
 * Form initials for the standard user-event dialog.
 *
 * Timeline edits always open as ``calendarKind: "normal"`` so special kinds
 * and finance stay on the item form. Schedule edits keep the stored kind.
 */

import type { UserEvent } from "../../api/userEvents";
import { normalizeNotifyPref } from "../notify/notifyPref";
import type { UserEventFormValues } from "./userEventFormModel";
import { toUserEventFormWorksetId } from "./userEvents";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import type { TimelineItem } from "../../types";

/** Schedule one-off edit prefill. Preserves stored ``user_events.kind``. */
export function userEventToFormValues(event: UserEvent): Partial<UserEventFormValues> {
  return {
    kind: "one_off",
    calendarKind: event.kind ?? "normal",
    title: event.title,
    startTime: event.startTime,
    endTime: event.endTime ?? "",
    location: event.location ?? "",
    body: event.body ?? "",
    worksetId: event.worksetId || SYSTEM_WORKSET_ID,
    isAllDay: Boolean(event.isAllDay),
    remindBeforeDays:
      event.remindBeforeDays == null ? "" : String(event.remindBeforeDays),
    notifyPref: event.notifyPref ?? "inherit",
    itemId: event.itemId ?? "",
    amountInput: event.amount == null ? "" : String(event.amount),
    direction: event.direction === "income" ? "income" : "expense",
  };
}

/**
 * Timeline edit prefill. ``calendarKind`` stays ``"normal"`` — timeline does
 * not edit expires / purchase_effective or finance amounts.
 */
export function timelineItemToFormInitial(
  event: TimelineItem,
): Partial<UserEventFormValues> {
  return {
    title: event.title,
    startTime: event.startTime ?? "",
    endTime: event.endTime ?? "",
    location: event.location ?? "",
    body: event.body ?? "",
    worksetId: toUserEventFormWorksetId(event.worksetId),
    isAllDay: Boolean(event.isAllDay),
    remindBeforeDays:
      event.remindBeforeDays != null ? String(event.remindBeforeDays) : "",
    itemId: event.itemId?.trim() ?? "",
    notifyPref: normalizeNotifyPref(event.notifyPref),
    calendarKind: "normal",
  };
}

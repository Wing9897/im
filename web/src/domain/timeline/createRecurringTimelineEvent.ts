/**
 * Create a recurring calendar plan from the timeline "Add event" dialog.
 *
 * Product model: recurring series are calendar resources, not analysis tasks.
 */

import { createRecurringSeries } from "../../api/recurringSeries";
import type { RecurringSeries } from "../../types/recurring";
import {
  DEFAULT_CALENDAR_NOTIFY_PREF,
  normalizeNotifyPref,
  type NotifyPref,
} from "../notify/notifyPref";
import { toUserEventFormWorksetId } from "./userEvents";

export type CreateRecurringTimelineEventParams = {
  title: string;
  worksetId: string;
  isAllDay: boolean;
  /** HH:MM — required when not all-day */
  eventStartTime: string;
  eventEndTime?: string;
  location?: string;
  body?: string;
  rrule: string;
  /** Optional parent inventory item (item owns this recurring calendar). */
  itemId?: string | null;
  notifyPref?: NotifyPref;
};

export async function createRecurringTimelineEvent(
  params: CreateRecurringTimelineEventParams,
): Promise<RecurringSeries> {
  const name = params.title.trim();
  const rrule = params.rrule.trim();
  if (!name) {
    throw new Error("title is required");
  }
  if (!rrule) {
    throw new Error("rrule is required");
  }

  const worksetId = toUserEventFormWorksetId(params.worksetId);
  const isAllDay = Boolean(params.isAllDay);
  const eventStartTime = isAllDay ? null : params.eventStartTime.trim() || null;
  const eventEndTime = isAllDay ? null : params.eventEndTime?.trim() || null;
  const location = params.location?.trim() || null;
  const description = params.body?.trim() || null;
  const itemId = params.itemId?.trim() || null;

  if (!isAllDay && !eventStartTime) {
    throw new Error("eventStartTime is required unless eventIsAllDay is true");
  }

  return createRecurringSeries({
    name,
    description,
    rrule,
    eventStartTime,
    eventEndTime,
    eventIsAllDay: isAllDay,
    eventLocation: location,
    eventDescription: description,
    worksetId,
    itemId,
    notifyPref: normalizeNotifyPref(params.notifyPref, DEFAULT_CALENDAR_NOTIFY_PREF),
  });
}

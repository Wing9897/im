/**
 * Create a recurring calendar plan from the timeline "Add event" dialog.
 *
 * Product model: 「循環事件」is not a user_event row — it is an
 * ``analysisMode=recurring`` task with an RRULE schedule.
 *
 * **Maintenance point**: uses atomic ``POST /api/v1/tasks/recurring``
 * (same writer as agent ``calendar.create_recurring_task``). Do not reintroduce
 * the two-step POST shell + PUT schedule path for timeline creates.
 */

import { createRecurringTask } from "../../api/tasks";
import type { TaskMutationResult } from "../../types";
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
};

export async function createRecurringTimelineEvent(
  params: CreateRecurringTimelineEventParams,
): Promise<TaskMutationResult> {
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

  if (!isAllDay && !eventStartTime) {
    throw new Error("eventStartTime is required unless eventIsAllDay is true");
  }

  return createRecurringTask({
    name,
    description,
    rrule,
    eventStartTime,
    eventEndTime,
    eventIsAllDay: isAllDay,
    eventLocation: location,
    eventDescription: description,
    worksetId,
  });
}

/**
 * Create a recurring calendar plan from the timeline "Add event" dialog.
 *
 * Product model: 「循環事件」is not a user_event row — it is an
 * ``analysisMode=recurring`` task plus ``PUT /tasks/{id}/schedule`` (RRULE).
 */

import { putTaskSchedule } from "../../api/taskSchedule";
import { createTask, deleteTask } from "../../api/tasks";
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
  const eventEndTime = isAllDay
    ? null
    : (params.eventEndTime?.trim() || null);
  const location = params.location?.trim() || null;
  const description = params.body?.trim() || null;

  if (!isAllDay && !eventStartTime) {
    throw new Error("eventStartTime is required unless eventIsAllDay is true");
  }

  const created = await createTask({
    name,
    description,
    analysisMode: "recurring",
    promptTemplate: "",
    channelIds: [],
    includeInTimeline: true,
    worksetId,
  });

  try {
    await putTaskSchedule(created.id, {
      rrule,
      eventStartTime,
      eventEndTime,
      eventIsAllDay: isAllDay,
      eventLocation: location,
      eventDescription: description,
    });
  } catch (error) {
    // Two-step create leaves an empty recurring shell if schedule upsert fails;
    // roll it back so retries do not pile up orphan tasks in the catalog/filter.
    await deleteTask(created.id).catch(() => undefined);
    throw error;
  }

  return created;
}

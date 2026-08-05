import type { TaskSchedule, TaskScheduleConfig } from "../../api/taskSchedule";
import type { CreateRecurringTaskConfig } from "../../api/tasks";
import type { AnalysisTask, TaskFormState } from "../../types";
import { presetToTriggerRrule, triggerRruleToPreset } from "./triggerSchedule";

/** Keep canonical scheduleRrule aligned with FE preset fields. */
export function withSyncedTriggerSchedule(
  state: Pick<TaskFormState, "scheduleType" | "scheduleValue" | "scheduleRrule">,
): Pick<TaskFormState, "scheduleType" | "scheduleValue" | "scheduleRrule"> {
  return {
    scheduleType: state.scheduleType,
    scheduleValue: state.scheduleValue,
    scheduleRrule: presetToTriggerRrule(state.scheduleType, state.scheduleValue),
  };
}

/** Resolve FE presets + canonical RRULE from a persisted task wire shape. */
export function scheduleFieldsFromTask(
  task: Pick<AnalysisTask, "scheduleRrule">,
): Pick<TaskFormState, "scheduleType" | "scheduleValue" | "scheduleRrule"> {
  const fromCanonical = triggerRruleToPreset(task.scheduleRrule);
  if (fromCanonical) {
    return withSyncedTriggerSchedule({
      ...fromCanonical,
      scheduleRrule: task.scheduleRrule ?? null,
    });
  }
  // Unmappable RRULE: preserve wire value so save cannot overwrite with seconds_10.
  const preserved = task.scheduleRrule?.trim() || null;
  return {
    scheduleType: "seconds_10",
    scheduleValue: null,
    scheduleRrule: preserved ?? presetToTriggerRrule("seconds_10", null),
  };
}

/** Builds the schedule subresource payload for recurring tasks. */
export function formStateToTaskSchedule(formState: TaskFormState): TaskScheduleConfig {
  const isAllDay = formState.eventIsAllDay;
  return {
    rrule: formState.rrule.trim(),
    eventStartTime: isAllDay ? null : formState.eventStartTime.trim() || null,
    eventEndTime: isAllDay ? null : formState.eventEndTime.trim() || null,
    eventIsAllDay: isAllDay,
    eventLocation: formState.eventLocation.trim() || null,
    eventDescription: formState.eventDescription.trim() || null,
  };
}

/**
 * Payload for atomic ``POST /api/v1/tasks/recurring``.
 * Same writer as timeline ``createRecurringTimelineEvent`` — do not use
 * shell ``POST /tasks`` + ``PUT /schedule`` for task-page creates.
 */
export function formStateToCreateRecurringConfig(
  formState: TaskFormState,
): CreateRecurringTaskConfig {
  const schedule = formStateToTaskSchedule(formState);
  return {
    name: formState.name.trim(),
    description: formState.description.trim() || null,
    rrule: schedule.rrule,
    eventStartTime: schedule.eventStartTime,
    eventEndTime: schedule.eventEndTime,
    eventIsAllDay: schedule.eventIsAllDay,
    eventLocation: schedule.eventLocation,
    eventDescription: schedule.eventDescription,
    worksetId: formState.worksetId,
  };
}

/** Merge schedule fields into form state after GET /tasks/{id}/schedule. */
export function applyScheduleToFormState(
  formState: TaskFormState,
  schedule: TaskSchedule,
): TaskFormState {
  return {
    ...formState,
    rrule: schedule.rrule ?? "",
    eventStartTime: schedule.eventStartTime ?? "",
    eventEndTime: schedule.eventEndTime ?? "",
    eventIsAllDay: schedule.eventIsAllDay ?? false,
    eventLocation: schedule.eventLocation ?? "",
    eventDescription: schedule.eventDescription ?? "",
  };
}

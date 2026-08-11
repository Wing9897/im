import type { AnalysisTask, TaskFormState } from "../../types";
import { presetToTriggerRrule, triggerRruleToPreset } from "./triggerSchedule";

/** Keep canonical scheduleRrule aligned with FE preset fields. */
export function withSyncedTriggerSchedule(
  state: Pick<
    TaskFormState,
    "scheduleType" | "scheduleValue" | "scheduleRrule"
  >,
): Pick<TaskFormState, "scheduleType" | "scheduleValue" | "scheduleRrule"> {
  return {
    scheduleType: state.scheduleType,
    scheduleValue: state.scheduleValue,
    scheduleRrule: presetToTriggerRrule(
      state.scheduleType,
      state.scheduleValue,
    ),
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

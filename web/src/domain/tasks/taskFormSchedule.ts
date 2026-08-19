import type { AnalysisTask, TaskFormState } from "../../types";
import {
  LEGACY_UNMAPPED_SCHEDULE_TYPE,
  presetToTriggerRrule,
  triggerRruleToPreset,
} from "./triggerSchedule";

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
  // Legacy / non-preset RRULE: snap UI + write SoT to hourly (no raw RRULE in UI).
  return withSyncedTriggerSchedule({
    scheduleType: LEGACY_UNMAPPED_SCHEDULE_TYPE,
    scheduleValue: null,
    scheduleRrule: null,
  });
}

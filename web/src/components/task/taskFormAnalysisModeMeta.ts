import type { AnalysisMode } from "../../types";
import i18n from "../../i18n";
import {
  analysisModeHidesPromptAndChannel,
  analysisModeShowsRruleFields,
} from "../../domain/tasks/analysisModeCapabilities";
import {
  TASK_EMPLOYEE_GROUPS,
  TASK_EMPLOYEE_ORDER,
  analysisModeForTaskEmployee,
  taskEmployeeForAnalysisMode,
  type TaskEmployeeGroupId,
  type TaskEmployeeId,
} from "../../domain/tasks/taskEmployee";

type TaskFormAnalysisModeMeta = {
  displayLabel: string;
  modeOptionLabel: string;
  modeDescription: string;
  promptLabel: string;
  promptPlaceholder: string;
  promptHint: string;
  /** When true, the mode uses recurring-task fields instead of analysis fields */
  isRecurringMode?: boolean;
  /** Whether this mode hides prompt/channel fields (recurring). */
  hidesPromptAndChannel?: boolean;
};

/** Editor picker order: schedule clerk first, then AI employees. */
export const taskFormAnalysisModeOrder: AnalysisMode[] = TASK_EMPLOYEE_ORDER.map(
  (employeeId) => analysisModeForTaskEmployee(employeeId),
);

export type TaskFormModeGroupId = TaskEmployeeGroupId;

export const taskFormAnalysisModeGroups: ReadonlyArray<{
  id: TaskFormModeGroupId;
  modes: readonly AnalysisMode[];
}> = TASK_EMPLOYEE_GROUPS.map((group) => ({
  id: group.id,
  modes: group.employees.map((employeeId) => analysisModeForTaskEmployee(employeeId)),
}));

/** L2 employee display name (aiStaff / schedule clerk). */
export function getTaskEmployeeDisplayName(employeeId: TaskEmployeeId): string {
  if (employeeId === "scheduleClerk") {
    return String(i18n.t("tasks.employees.scheduleClerk.name"));
  }
  return String(i18n.t(`aiStaff.${employeeId}`));
}

export function getTaskFormAnalysisModeMeta(
  analysisMode: AnalysisMode,
): TaskFormAnalysisModeMeta {
  const prefix = `tasks.modes.${analysisMode}`;
  return {
    // Cards / filters / badges share L2 employee bilingual names (not short mode labels).
    displayLabel: getTaskEmployeeDisplayName(taskEmployeeForAnalysisMode(analysisMode)),
    modeOptionLabel: String(i18n.t(`${prefix}.modeOptionLabel`)),
    modeDescription: String(i18n.t(`${prefix}.modeDescription`)),
    promptLabel: String(i18n.t(`${prefix}.promptLabel`)),
    promptPlaceholder: String(i18n.t(`${prefix}.promptPlaceholder`)),
    promptHint: String(i18n.t(`${prefix}.promptHint`)),
    isRecurringMode: analysisModeShowsRruleFields(analysisMode) || undefined,
    hidesPromptAndChannel: analysisModeHidesPromptAndChannel(analysisMode) || undefined,
  };
}

/** One-line capability blurb for L2 picker cards. */
export function getTaskEmployeeBlurb(employeeId: TaskEmployeeId): string {
  if (employeeId === "scheduleClerk") {
    return String(i18n.t("tasks.employees.scheduleClerk.blurb"));
  }
  return getTaskFormAnalysisModeMeta(analysisModeForTaskEmployee(employeeId)).modeDescription;
}

export function getTaskEmployeeIdForMode(mode: AnalysisMode): TaskEmployeeId {
  return taskEmployeeForAnalysisMode(mode);
}

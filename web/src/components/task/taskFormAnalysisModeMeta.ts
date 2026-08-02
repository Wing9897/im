import type { AnalysisMode } from "../../types";
import i18n from "../../i18n";
import {
  analysisModeHidesPromptAndChannel,
  analysisModeShowsRruleFields,
} from "../../domain/tasks/analysisModeCapabilities";
import {
  TASK_EMPLOYEE_ORDER,
  analysisModeForTaskEmployee,
  taskEmployeeForAnalysisMode,
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

/** Editor picker order: recurring first, then AI task types. */
export const taskFormAnalysisModeOrder: AnalysisMode[] = TASK_EMPLOYEE_ORDER.map(
  (employeeId) => analysisModeForTaskEmployee(employeeId),
);

/** Neutral product name for a task type (not AI staff job title). */
export function getTaskEmployeeDisplayName(employeeId: TaskEmployeeId): string {
  return String(i18n.t(`tasks.employees.${employeeId}.name`));
}

export function getTaskFormAnalysisModeMeta(
  analysisMode: AnalysisMode,
): TaskFormAnalysisModeMeta {
  const prefix = `tasks.modes.${analysisMode}`;
  return {
    // Cards / filters / badges share task-type product names.
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

/** One-line capability blurb for task-type picker cards. */
export function getTaskEmployeeBlurb(employeeId: TaskEmployeeId): string {
  return String(i18n.t(`tasks.employees.${employeeId}.blurb`));
}

export function getTaskEmployeeIdForMode(mode: AnalysisMode): TaskEmployeeId {
  return taskEmployeeForAnalysisMode(mode);
}

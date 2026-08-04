/** Returns the task-type product name for an analysis mode (locale-aware). */
import i18n from "../i18n";
import { isAnalysisMode } from "../domain/tasks/analysisModeCapabilities";
import {
  isTaskAnalysisTimeRange,
  TASK_ANALYSIS_TIME_RANGE_I18N_KEYS,
} from "../domain/tasks/taskAnalysisTimeRange";
import { taskEmployeeForAnalysisMode } from "../domain/tasks/taskEmployee";

export function formatAnalysisMode(value: string | null | undefined): string {
  if (isAnalysisMode(value)) {
    const employeeId = taskEmployeeForAnalysisMode(value);
    return String(i18n.t(`tasks.employees.${employeeId}.name`));
  }
  return String(i18n.t("ui.unknownMode"));
}

/**
 * Label for a **task** analysis time range (``analysis_time_range``).
 *
 * Unknown tokens (including monitor-only ``12h``／``24h``) are returned as-is —
 * never mapped to “unlimited”.
 */
export function formatAnalysisTimeRange(value: string | null | undefined): string {
  if (value == null || value === "") {
    return String(i18n.t("tasks.editor.timeAll"));
  }
  if (isTaskAnalysisTimeRange(value)) {
    return String(i18n.t(TASK_ANALYSIS_TIME_RANGE_I18N_KEYS[value]));
  }
  return value;
}

/** Like `formatAnalysisTimeRange` but returns null for invalid or empty values. */
export function formatAnalysisTimeRangeNullable(value: string | null): string | null {
  if (!value) return null;
  if (!isTaskAnalysisTimeRange(value)) return null;
  return formatAnalysisTimeRange(value);
}

/** Formats a batch message count as a non-negative integer string, defaulting to "0" for invalid input. */
export function formatBatchMessageCount(actualCount: number | null | undefined): string {
  if (typeof actualCount !== "number" || !Number.isFinite(actualCount)) return "0";
  return `${Math.max(0, Math.trunc(actualCount))}`;
}

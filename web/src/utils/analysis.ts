/** Returns the task-type product name for an analysis mode (locale-aware). */
import i18n from "../i18n";
import { isAnalysisMode } from "../domain/tasks/analysisModeCapabilities";
import { taskEmployeeForAnalysisMode } from "../domain/tasks/taskEmployee";

export function formatAnalysisMode(value: string | null | undefined): string {
  if (isAnalysisMode(value)) {
    const employeeId = taskEmployeeForAnalysisMode(value);
    return String(i18n.t(`tasks.employees.${employeeId}.name`));
  }
  return String(i18n.t("ui.unknownMode"));
}

/** Returns the label for an analysis time range value (e.g. "1d" → localized “last 1 day”). */
export function formatAnalysisTimeRange(value: string | null | undefined): string {
  if (value === "1d") return String(i18n.t("tasks.editor.time1d"));
  if (value === "7d") return String(i18n.t("tasks.editor.time7d"));
  if (value === "30d") return String(i18n.t("tasks.editor.time30d"));
  if (value === "all") return String(i18n.t("tasks.editor.timeAll"));
  return String(i18n.t("tasks.editor.timeAll"));
}

/** Like `formatAnalysisTimeRange` but returns null for invalid or empty values. */
export function formatAnalysisTimeRangeNullable(value: string | null): string | null {
  if (!value) return null;
  if (!["1d", "7d", "30d", "all"].includes(value)) return null;
  return formatAnalysisTimeRange(value);
}

/** Formats a batch message count as a non-negative integer string, defaulting to "0" for invalid input. */
export function formatBatchMessageCount(actualCount: number | null | undefined): string {
  if (typeof actualCount !== "number" || !Number.isFinite(actualCount)) return "0";
  return `${Math.max(0, Math.trunc(actualCount))}`;
}

/** Returns the display label for an analysis mode (locale-aware). */
import i18n from "../i18n";
import { isAnalysisMode } from "../domain/tasks/analysisModeCapabilities";

export function formatAnalysisMode(value: string | null | undefined): string {
  if (isAnalysisMode(value)) {
    return String(i18n.t(`tasks.modes.${value}.displayLabel`));
  }
  return String(i18n.t("ui.unknownMode"));
}

/** Returns the label for an analysis time range value (e.g. "1d" → localized “last 1 day”). */
export function formatAnalysisTimeRange(value: string | null | undefined): string {
  const normalized =
    value === "12h" || value === "24h" ? "1d" : value;
  if (normalized === "1d") return String(i18n.t("tasks.editor.time1d"));
  if (normalized === "7d") return String(i18n.t("tasks.editor.time7d"));
  if (normalized === "30d") return String(i18n.t("tasks.editor.time30d"));
  if (normalized === "all") return String(i18n.t("tasks.editor.timeAll"));
  return String(i18n.t("tasks.editor.timeAll"));
}

/** Like `formatAnalysisTimeRange` but returns null for invalid or empty values. */
export function formatAnalysisTimeRangeNullable(value: string | null): string | null {
  if (!value) return null;
  const normalized = value === "12h" || value === "24h" ? "1d" : value;
  if (!["1d", "7d", "30d", "all"].includes(normalized)) return null;
  return formatAnalysisTimeRange(normalized);
}

/** Formats a batch message count as a non-negative integer string, defaulting to "0" for invalid input. */
export function formatBatchMessageCount(actualCount: number | null | undefined): string {
  if (typeof actualCount !== "number" || !Number.isFinite(actualCount)) return "0";
  return `${Math.max(0, Math.trunc(actualCount))}`;
}

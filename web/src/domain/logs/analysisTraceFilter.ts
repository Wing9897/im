import { APP_LOG_KIND } from "../../api/appLogClient";
import { LOGS_SHOW_ANALYSIS_TRACE_STORAGE_KEY } from "../prefs";

export const ANALYSIS_TRACE_KIND = APP_LOG_KIND.ANALYSIS_TRACE;

export function isAnalysisTraceLog(entry: { kind?: string | null }): boolean {
  return entry.kind === ANALYSIS_TRACE_KIND;
}

/** Drop analysis.trace rows unless the user opted in. */
export function filterAnalysisTraceLogs<T extends { kind?: string | null }>(
  logs: readonly T[],
  showAnalysisTrace: boolean,
): T[] {
  if (showAnalysisTrace) {
    return [...logs];
  }
  return logs.filter((entry) => !isAnalysisTraceLog(entry));
}

/** Read the persisted Logs-page toggle (defaults to hidden). */
export function readShowAnalysisTracePref(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(LOGS_SHOW_ANALYSIS_TRACE_STORAGE_KEY);
    if (raw === null) return false;
    return JSON.parse(raw) === true;
  } catch {
    return false;
  }
}

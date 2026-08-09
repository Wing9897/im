import type { ActiveAnalysisState } from "../../context/appRuntimeShared";

/** Build per-task active analysis map from the global activeAnalyses map (re-keyed from batchId to taskId) */
export function mapActiveAnalysesToTasks(
  activeAnalyses: Map<string, ActiveAnalysisState>,
): Map<string, ActiveAnalysisState> {
  const result = new Map<string, ActiveAnalysisState>();
  for (const analysis of activeAnalyses.values()) {
    if (analysis.taskId) {
      result.set(analysis.taskId, analysis);
    }
  }
  return result;
}

/** True when this task id is in the live SSE active-analysis set (current batch). */
export function isTaskActivelyAnalyzing(
  activeAnalyses: Map<string, ActiveAnalysisState>,
  taskId: string,
): boolean {
  if (!taskId) return false;
  for (const analysis of activeAnalyses.values()) {
    if (analysis.taskId === taskId) return true;
  }
  return false;
}

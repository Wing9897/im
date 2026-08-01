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

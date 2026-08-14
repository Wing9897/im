import type { ActiveAnalysisState, ActiveAnalysisInput } from "../types";
import { toActiveAnalysisState } from "./appRuntimeShared";

export type ActiveAnalysisEvent =
  | { type: "started"; batchId: string; taskName: string; messageCount: number }
  | { type: "completed"; batchId: string }
  | { type: "failed"; batchId: string };

/** Pure reducer for active-analysis SSE events (batchId-keyed map). */
export function applyActiveAnalysisEvent(
  state: Map<string, ActiveAnalysisState>,
  event: ActiveAnalysisEvent,
): Map<string, ActiveAnalysisState> {
  const next = new Map(state);
  switch (event.type) {
    case "started": {
      const input: ActiveAnalysisInput = {
        batchId: event.batchId,
        taskName: event.taskName,
        messageCount: event.messageCount,
        taskId: "",
        estimatedTokens: 0,
        llmProvider: "",
        llmModel: "",
      };
      next.set(event.batchId, toActiveAnalysisState(input, state.get(event.batchId)));
      break;
    }
    case "completed":
    case "failed":
      next.delete(event.batchId);
      break;
  }
  return next;
}

export function upsertActiveAnalysis(
  state: Map<string, ActiveAnalysisState>,
  input: ActiveAnalysisInput,
): Map<string, ActiveAnalysisState> {
  const next = new Map(state);
  next.set(input.batchId, toActiveAnalysisState(input, state.get(input.batchId)));
  return next;
}

export function removeActiveAnalysis(
  state: Map<string, ActiveAnalysisState>,
  batchId: string,
): Map<string, ActiveAnalysisState> {
  const next = new Map(state);
  next.delete(batchId);
  return next;
}

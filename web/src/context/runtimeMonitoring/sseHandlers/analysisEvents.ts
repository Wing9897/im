import type {
  AnalysisCompletedPayload,
  AnalysisFailedPayload,
  AnalysisPausedChangedPayload,
  AnalysisStartedPayload,
} from "../../../types";
import { type ActiveAnalysisInput } from "../../appRuntimeShared";
import {
  removeActiveAnalysis,
  upsertActiveAnalysis,
} from "../../activeAnalysesReducer";
import type { EventListenerDeps } from "./types";

export function handleAnalysisStarted(data: unknown, deps: EventListenerDeps): void {
  if (data == null || typeof data !== "object") return;
  const payload = data as AnalysisStartedPayload;
  const taskId = payload.taskId ?? "";
  const batchId = payload.batchId ?? "";
  if (!taskId || !batchId) return;

  const { state, refreshLogsForBackendEvent } = deps;
  const nextActiveInput: ActiveAnalysisInput = {
    taskId,
    taskName: payload.taskName ?? "",
    batchId,
    messageCount: payload.messageCount ?? 0,
    estimatedTokens: payload.estimatedTokens ?? 0,
    llmProvider: payload.llmProvider ?? "",
    llmModel: payload.llmModel ?? "",
  };
  state.setActiveAnalyses((prev) => upsertActiveAnalysis(prev, nextActiveInput));
  state.setLastAnalysisEvent({
    type: "started",
    payload: {
      ...payload,
      taskId,
      taskName: payload.taskName ?? "",
      batchId,
      messageCount: payload.messageCount ?? 0,
      llmModel: payload.llmModel ?? "",
      llmProvider: payload.llmProvider ?? "",
      estimatedTokens: payload.estimatedTokens ?? 0,
    },
    receivedAt: Date.now(),
  });
  refreshLogsForBackendEvent();
}

export function handleAnalysisCompleted(data: unknown, deps: EventListenerDeps): void {
  if (data == null || typeof data !== "object") return;
  const payload = data as AnalysisCompletedPayload;
  const taskId = payload.taskId ?? "";
  const batchId = payload.batchId ?? "";
  if (!batchId) return;

  const { state, refreshQueueStatus, refreshLogsForBackendEvent } = deps;
  state.setActiveAnalyses((prev) => removeActiveAnalysis(prev, batchId));
  state.setLastAnalysisEvent({
    type: "completed",
    payload: {
      ...payload,
      taskId,
      batchId,
      analysisMode: payload.analysisMode ?? "",
      findingsCount: payload.findingsCount ?? 0,
      hasFindings: payload.hasFindings ?? false,
      overlapStatistics: payload.overlapStatistics ?? null,
    },
    receivedAt: Date.now(),
  });
  refreshQueueStatus(false);
  refreshLogsForBackendEvent();
}

export function handleAnalysisFailed(data: unknown, deps: EventListenerDeps): void {
  if (data == null || typeof data !== "object") return;
  const payload = data as AnalysisFailedPayload;
  const taskId = payload.taskId ?? "";
  const batchId = payload.batchId ?? "";
  if (!batchId) return;

  const { state, refreshQueueStatus, refreshLogsForBackendEvent } = deps;
  state.setActiveAnalyses((prev) => removeActiveAnalysis(prev, batchId));
  const retriesExhausted = payload.retriesExhausted === true;
  const safeFailedPayload: AnalysisFailedPayload = {
    taskId,
    taskName: payload.taskName ?? "",
    batchId,
    error: payload.error ?? "Unknown error",
    retrying: payload.retrying ?? false,
    currentRetry: payload.currentRetry ?? 0,
    maxRetries: payload.maxRetries ?? 0,
    retriesExhausted,
  };
  state.setLastAnalysisEvent({
    type: "failed",
    payload: safeFailedPayload,
    receivedAt: Date.now(),
  });
  refreshQueueStatus(retriesExhausted);
  refreshLogsForBackendEvent();
}

export function handleAnalysisPausedChanged(data: unknown, deps: EventListenerDeps): void {
  if (data == null || typeof data !== "object") return;
  const payload = data as Partial<AnalysisPausedChangedPayload>;
  if (typeof payload.analysisPaused === "boolean") {
    deps.state.setAnalysisPaused(payload.analysisPaused);
  }
  deps.refreshQueueStatus(true);
}

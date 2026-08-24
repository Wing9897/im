// ============================================================
// Analysis Type Definitions
// ============================================================

import type { components } from "../api/generated/schema";

export type {
  AnalysisEvent,
  AnalysisEventPage,
} from "./analysisEvent";
export type { TimelineItem } from "./timelineItem";
export { asTimedAnalysisEvent } from "./timelineItem";

/** Ranked topic returned by `/results/trending`. */
export type TrendingTopic = components["schemas"]["TrendingTopicResponse"];

/** Queue status from GET `/results/queue`. */
export type QueueStatus = components["schemas"]["ResultsQueueResponse"];

/** Processing or attention-worthy batch row inside the queue payload. */
export type ProcessingBatchInfo = components["schemas"]["QueueBatchResponse"];

/** Activity span for Gantt / project detail — OpenAPI `TaskActivitySpanResponse`. */
export type TaskActivitySpan = components["schemas"]["TaskActivitySpanResponse"];

/**
 * Virtual ownership span vs real analysis task row.
 * Trust wire ``sourceKind``; ``worksetId`` is authoritative on workset rows
 * (``taskId`` is null).
 */
export function isWorksetActivitySpan(
  span: Pick<TaskActivitySpan, "sourceKind">,
): boolean {
  return span.sourceKind === "workset";
}

/** One completed agent-tick batch for the detail log. */
export type AgentTickLogEntry = components["schemas"]["AgentTickLogEntryResponse"];

/** Schedule fire still draining waves (pending/processing batch). */
export type AgentTickInFlight = components["schemas"]["AgentTickInFlightResponse"];

/** Cursor backlog + recent ticks for an agent task. */
export type AgentTickStatus = components["schemas"]["AgentTickStatusResponse"];

/** Per-task analysis statistics returned by `/results/stats`. */
export type TaskAnalysisStats = components["schemas"]["TaskAnalysisStatsResponse"];

/** State of an active (in-progress) analysis.
 *  Wire fields follow ``SseAnalysisStartedPayload``; ``startedAt`` is a local
 *  elapsed-time clock and is not on the SSE payload.
 *  ``webSearchMode`` / ``analysisMode`` from the payload are unused in the UI.
 */
export type ActiveAnalysisState = Pick<
  components["schemas"]["SseAnalysisStartedPayload"],
  "taskId" | "taskName" | "batchId" | "messageCount" | "estimatedTokens" | "llmProvider" | "llmModel"
> & {
  startedAt: string;
};

/** Input type for creating an active analysis state (startedAt is auto-generated) */
export type ActiveAnalysisInput = Omit<ActiveAnalysisState, "startedAt">;

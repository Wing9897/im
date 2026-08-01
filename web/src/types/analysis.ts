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

/** An expanded RRULE occurrence for a recurring task */
export type CalendarOccurrence = Omit<
  components["schemas"]["CalendarOccurrenceResponse"],
  "dismissed"
> & {
  /** Older local fixtures may omit the server-defaulted marker. */
  dismissed?: boolean;
};

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

/** One completed project-tick batch for the detail log. */
export interface ProjectTickLogEntry {
  batchId: string;
  status: string;
  /** Server sends a free-form string; `success` / `skipped` / `error` are the known values. */
  outcome: string;
  messageCount: number;
  agentMessage?: string | null;
  errorMessage?: string | null;
  toolCalls?: Array<{
    name: string;
    arguments?: Record<string, unknown>;
    resultSummary?: string;
  }>;
  createdAt?: string | null;
  completedAt?: string | null;
}

/** Schedule fire still draining waves (pending/processing batch). */
export interface ProjectTickInFlight {
  batchId: string;
  status: string;
  messageCount: number;
  createdAt?: string | null;
  updatedAt?: string | null;
}

/** Cursor backlog + recent ticks for a project task. */
export interface ProjectTickStatus {
  taskId: string;
  cursorAt: string | null;
  pendingSinceCursor: number;
  ticks: ProjectTickLogEntry[];
  inFlight?: ProjectTickInFlight | null;
}

/** Per-task analysis statistics returned by `/results/stats`. */
export type TaskAnalysisStats = components["schemas"]["TaskAnalysisStatsResponse"];

/** State of an active (in-progress) analysis */
export interface ActiveAnalysisState {
  taskId?: string;
  taskName?: string;
  batchId: string;
  messageCount: number;
  estimatedTokens?: number | null;
  llmModel?: string | null;
  startedAt: string;
}

/** Input type for creating an active analysis state (startedAt is auto-generated) */
export type ActiveAnalysisInput = Omit<ActiveAnalysisState, "startedAt">;

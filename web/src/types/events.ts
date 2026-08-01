// ============================================================
// SSE Event Payload Type Definitions
// ============================================================

import type { CollectorStatus, ConnectionStatus } from "./common";
import type { Message } from "./messages";

/** Payload for the `messages_updated` event */
export interface MessagesUpdatedPayload {
  messages: Message[];
}

/** Overlap statistics returned from the backend after batch analysis */
interface OverlapStatistics {
  overlapUsedCount: number;
  overlapTrimmedCount: number;
  overlapTokens: number;
  primaryTokens: number;
  totalTokens: number;
}

/** Payload for the `analysis_completed` event */
export interface AnalysisCompletedPayload {
  taskId: string;
  batchId: string;
  analysisMode: string;
  findingsCount: number;
  hasFindings: boolean;
  overlapStatistics: OverlapStatistics | null;
}

/** Payload for the `analysis_started` event */
export interface AnalysisStartedPayload {
  taskId: string;
  taskName: string;
  batchId: string;
  messageCount: number;
  estimatedTokens: number;
  llmProvider: string;
  llmModel: string;
}

/** Payload for the `analysis_failed` event */
export interface AnalysisFailedPayload {
  taskId: string;
  taskName: string;
  batchId: string;
  error: string;
  retrying: boolean;
  currentRetry: number;
  maxRetries: number;
  retriesExhausted: boolean;
}

/** Payload emitted when exhausted retries auto-pause global analysis. */
export interface AnalysisPausedChangedPayload {
  analysisPaused: boolean;
  reason: "batch_retries_exhausted";
  taskId: string;
  taskName: string;
  batchId: string;
}

/** Payload for the `collector_status_changed` event (aggregate CollectorStatus). */
export interface CollectorStatusChangedPayload {
  status: CollectorStatus;
  /** Present when a specific adapter connection fails */
  adapter_name?: string;
  /** Error summary when adapter connection fails */
  error_summary?: string;
  /** Optional trace id for error toast correlation */
  correlation_id?: string;
}

/** Payload for the `account_status_changed` event */
export interface AccountStatusChangedPayload {
  accountId: string;
  /** Adapter reconnect emits this transient state before persisted connection settles. */
  status: ConnectionStatus;
  lastError?: string | null;
}

/** Payload for resource CRUD invalidations. */
export interface ResourceModifiedPayload {
  resourceType: string;
  resourceId: string;
  action: "created" | "updated" | "deleted";
}

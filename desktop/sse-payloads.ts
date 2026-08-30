/**
 * Desktop-side mirrors of the SSE payload components.
 *
 * SoT is `server/api/schemas/responses/sse.py`, surfaced as OpenAPI
 * `Sse*Payload` components. The desktop tsconfig cannot reach the web
 * generated types, so the shapes are mirrored here and locked against
 * `web/openapi/openapi.json` by `tests/sse-payload-drift.test.ts`.
 *
 * Do not import web OpenAPI types into this package — keep the three
 * copies (server Pydantic / web generated / this file) in step via
 * drift tests, not a shared module.
 *
 * Non-identifying fields stay optional because the payload arrives over
 * the wire. `taskName` is deliberately extra on the completed payload —
 * the server does not emit it today, and it is kept as a display fallback.
 */

/** Parsed SSE event from the server stream. */
export interface SseMessage {
  event: string;
  data: string;
}

/** Payload for the `analysis_completed` SSE event. */
export interface AnalysisCompletedPayload {
  taskId: string;
  taskName?: string;
  batchId: string;
  analysisMode?: string;
  findingsCount?: number;
  hasFindings?: boolean;
  overlapStatistics?: Record<string, number> | null;
  webSearchMode?: string | null;
  messageCount?: number | null;
  skipped?: boolean | null;
  skipReason?: string | null;
}

/** Payload for the `analysis_failed` SSE event. */
export interface AnalysisFailedPayload {
  taskId: string;
  taskName?: string;
  batchId: string;
  error: string;
  retrying?: boolean;
  currentRetry?: number;
  maxRetries?: number;
  retriesExhausted?: boolean;
  analysisMode?: string | null;
  taskDeactivated?: boolean | null;
}

/** Payload for the `analysis_started` SSE event. */
export interface AnalysisStartedPayload {
  taskId: string;
  taskName: string;
  batchId: string;
  messageCount: number;
  estimatedTokens: number;
  llmProvider: string;
  llmModel: string;
  webSearchMode?: string | null;
  analysisMode?: string | null;
}

/** Payload for the `analysis_paused_changed` SSE event. */
export interface AnalysisPausedChangedPayload {
  analysisPaused: boolean;
  reason: 'batch_retries_exhausted';
  taskId: string;
  taskName: string;
  batchId: string;
}

/** Payload for the `collector_status_changed` SSE event. */
export interface CollectorStatusChangedPayload {
  status: 'running' | 'stopped' | 'error';
  adapterName?: string | null;
  errorSummary?: string | null;
  correlation_id?: string | null;
}

/** Payload for the `source_status_changed` SSE event. */
export interface SourceStatusChangedPayload {
  sourceId: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  lastError?: string | null;
}

/** Payload for the `resource_modified` SSE event. */
export interface ResourceModifiedPayload {
  resourceType: string;
  resourceId: string;
  action: 'created' | 'updated' | 'deleted';
}

/**
 * Top-level `messages_updated` field only. The nested `MessageResponse` lives
 * in web OpenAPI; desktop does not listen for this event.
 */
export interface MessagesUpdatedPayload {
  messages: unknown[];
}

/** Fields mirrored from `SseAnalysisCompletedPayload` (drift-tested). */
export const ANALYSIS_COMPLETED_FIELDS = [
  'taskId',
  'taskName',
  'batchId',
  'analysisMode',
  'findingsCount',
  'hasFindings',
  'overlapStatistics',
  'webSearchMode',
  'messageCount',
  'skipped',
  'skipReason',
] as const;

/** Fields mirrored from `SseAnalysisFailedPayload` (drift-tested). */
export const ANALYSIS_FAILED_FIELDS = [
  'taskId',
  'taskName',
  'batchId',
  'error',
  'retrying',
  'currentRetry',
  'maxRetries',
  'retriesExhausted',
  'analysisMode',
  'taskDeactivated',
] as const;

/** Fields mirrored from `SseAnalysisStartedPayload` (drift-tested). */
export const ANALYSIS_STARTED_FIELDS = [
  'taskId',
  'taskName',
  'batchId',
  'messageCount',
  'estimatedTokens',
  'llmProvider',
  'llmModel',
  'webSearchMode',
  'analysisMode',
] as const;

/** Fields mirrored from `SseAnalysisPausedChangedPayload` (drift-tested). */
export const ANALYSIS_PAUSED_CHANGED_FIELDS = [
  'analysisPaused',
  'reason',
  'taskId',
  'taskName',
  'batchId',
] as const;

/** Fields mirrored from `SseCollectorStatusChangedPayload` (drift-tested). */
export const COLLECTOR_STATUS_CHANGED_FIELDS = [
  'status',
  'adapterName',
  'errorSummary',
  'correlation_id',
] as const;

/** Fields mirrored from `SseSourceStatusChangedPayload` (drift-tested). */
export const SOURCE_STATUS_CHANGED_FIELDS = ['sourceId', 'status', 'lastError'] as const;

/** Fields mirrored from `SseResourceModifiedPayload` (drift-tested). */
export const RESOURCE_MODIFIED_FIELDS = ['resourceType', 'resourceId', 'action'] as const;

/** Fields mirrored from `SseMessagesUpdatedPayload` (drift-tested). */
export const MESSAGES_UPDATED_FIELDS = ['messages'] as const;

/** Fields mirrored from `SseOverlapStatistics` (nested on completed). */
export const OVERLAP_STATISTICS_FIELDS = [
  'overlapUsedCount',
  'overlapTrimmedCount',
  'overlapTokens',
  'primaryTokens',
  'totalTokens',
] as const;

/**
 * Fields the desktop keeps on purpose even though the server schema omits
 * them. Everything else must match the OpenAPI component exactly.
 */
export const DESKTOP_ONLY_COMPLETED_FIELDS = ['taskName'] as const;

/** Compile-time lock: the tuples above stay in step with the interfaces. */
type SameKeys<T, K extends string> =
  Exclude<keyof T, K> extends never
    ? Exclude<K, keyof T> extends never
      ? true
      : never
    : never;

const _completedFieldsMatchInterface: SameKeys<
  AnalysisCompletedPayload,
  (typeof ANALYSIS_COMPLETED_FIELDS)[number]
> = true;
const _failedFieldsMatchInterface: SameKeys<
  AnalysisFailedPayload,
  (typeof ANALYSIS_FAILED_FIELDS)[number]
> = true;
const _startedFieldsMatchInterface: SameKeys<
  AnalysisStartedPayload,
  (typeof ANALYSIS_STARTED_FIELDS)[number]
> = true;
const _pausedFieldsMatchInterface: SameKeys<
  AnalysisPausedChangedPayload,
  (typeof ANALYSIS_PAUSED_CHANGED_FIELDS)[number]
> = true;
const _collectorFieldsMatchInterface: SameKeys<
  CollectorStatusChangedPayload,
  (typeof COLLECTOR_STATUS_CHANGED_FIELDS)[number]
> = true;
const _sourceFieldsMatchInterface: SameKeys<
  SourceStatusChangedPayload,
  (typeof SOURCE_STATUS_CHANGED_FIELDS)[number]
> = true;
const _resourceFieldsMatchInterface: SameKeys<
  ResourceModifiedPayload,
  (typeof RESOURCE_MODIFIED_FIELDS)[number]
> = true;
const _messagesFieldsMatchInterface: SameKeys<
  MessagesUpdatedPayload,
  (typeof MESSAGES_UPDATED_FIELDS)[number]
> = true;
void _completedFieldsMatchInterface;
void _failedFieldsMatchInterface;
void _startedFieldsMatchInterface;
void _pausedFieldsMatchInterface;
void _collectorFieldsMatchInterface;
void _sourceFieldsMatchInterface;
void _resourceFieldsMatchInterface;
void _messagesFieldsMatchInterface;

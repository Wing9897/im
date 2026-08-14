/**
 * Desktop-side mirrors of the analysis SSE payload components.
 *
 * SoT is `server/api/schemas/responses/sse.py`, surfaced as the OpenAPI
 * components `SseAnalysisCompletedPayload` / `SseAnalysisFailedPayload`. The
 * desktop tsconfig cannot reach the web generated types, so the shapes are
 * mirrored here and locked against the exported schema by
 * `tests/sse-payload-drift.test.ts`, which compares the exported field tuples
 * below with `web/openapi/openapi.json`.
 *
 * Non-identifying fields stay optional because the payload arrives over the
 * wire. `taskName` is deliberately extra on the completed payload — the server
 * does not emit it today, and it is kept as a display fallback.
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
void _completedFieldsMatchInterface;
void _failedFieldsMatchInterface;

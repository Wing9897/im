// ============================================================
// SSE Event Payload Type Definitions (OpenAPI-generated aliases)
// ============================================================
//
// Source of truth: server/api/schemas/responses/sse.py, exported to OpenAPI
// components by server/api/openapi_ext.py. The wire envelope for every named
// event is `{"type": <event>, "payload": {...}}` (`SseEventEnvelope`);
// `sseClient.ts` unwraps `payload` before these types apply.
//
// Resource/status payloads are camelCase (`adapterName` / `errorSummary`).
// Error-body fields `error_code` / `correlation_id` stay snake_case.

import type { components } from "../api/generated/schema";

/** Payload for the `messages_updated` event */
export type MessagesUpdatedPayload = components["schemas"]["SseMessagesUpdatedPayload"];

/** Payload for the `analysis_started` event */
export type AnalysisStartedPayload = components["schemas"]["SseAnalysisStartedPayload"];

/** Payload for the `analysis_completed` event */
export type AnalysisCompletedPayload = components["schemas"]["SseAnalysisCompletedPayload"];

/** Overlap statistics attached to message-batch `analysis_completed` events */
export type OverlapStatistics = components["schemas"]["SseOverlapStatistics"];

/** Payload for the `analysis_failed` event */
export type AnalysisFailedPayload = components["schemas"]["SseAnalysisFailedPayload"];

/** Payload emitted when exhausted retries auto-pause global analysis. */
export type AnalysisPausedChangedPayload =
  components["schemas"]["SseAnalysisPausedChangedPayload"];

/** Payload for the `collector_status_changed` event (aggregate CollectorStatus). */
export type CollectorStatusChangedPayload =
  components["schemas"]["SseCollectorStatusChangedPayload"];

/** Payload for the `source_status_changed` event */
export type SourceStatusChangedPayload =
  components["schemas"]["SseSourceStatusChangedPayload"];

/** Payload for resource CRUD invalidations. */
export type ResourceModifiedPayload = components["schemas"]["SseResourceModifiedPayload"];

/** `data` envelope of each named SSE frame (see `sseClient.ts`). */
export type SseEventEnvelope = components["schemas"]["SseEventEnvelope"];

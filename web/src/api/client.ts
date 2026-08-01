/**
 * Public façade for the IntelligenceMonitor HTTP/SSE client.
 *
 * Implementation: `httpClient` + `parseApiError`; auth in `authRefresh`;
 * SSE transport in `sseClient`. Prefer importing from this module.
 */

export { ApiClient, NetworkError, apiClient } from "./httpClient";
export { ApiRequestError } from "./parseApiError";
export type { ApiError } from "./parseApiError";
export type {
  KnownSseEvent,
  SseConnection,
  SseEvent,
  SseEventPayloadMap,
} from "./sseClient";
export { resolveBaseUrl } from "./baseUrl";
export {
  isSetupAuthPath,
  isStoredAccessExpired,
  refreshAccessTokenOnce,
} from "./authRefresh";

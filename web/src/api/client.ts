/**
 * Public façade for the IntelligenceMonitor HTTP/SSE client.
 *
 * Implementation lives in `httpCore` + `authRefresh`; SSE transport in `sseClient`.
 * Keep importing `apiClient` / `ApiClient` from this module.
 */

export {
  ApiClient,
  ApiRequestError,
  NetworkError,
  apiClient,
  resolveBaseUrl,
  isSetupAuthPath,
  isStoredAccessExpired,
  refreshAccessTokenOnce,
} from "./httpCore";
export type {
  ApiError,
  KnownSseEvent,
  SseConnection,
  SseEvent,
  SseEventPayloadMap,
} from "./httpCore";

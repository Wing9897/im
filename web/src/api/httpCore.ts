/**
 * Thin barrel for the HTTP stack — prefer `./client` for app imports.
 * Implementation: `httpClient` + `httpErrors`; auth in `authRefresh`; SSE in `sseClient`.
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

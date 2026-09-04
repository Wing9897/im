/**
 * GET retry policy for the HTTP client (transient network / gateway errors).
 */

import { ApiRequestError } from "./parseApiError";
import { NetworkError } from "./httpErrors";

export const GET_RETRY_DELAYS_MS = [400, 1_000] as const;

export function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

/** User-cancelled fetch (AbortSignal) — not a timeout and not a UI error. */
export function isCancelledError(error: unknown): boolean {
  if (isAbortError(error)) return true;
  return error instanceof NetworkError && error.message === "Request cancelled";
}

export function shouldRetryGet(error: unknown): boolean {
  if (error instanceof NetworkError) {
    // Timeouts / explicit cancel should not hammer the server.
    return error.message === "Backend unreachable";
  }
  if (error instanceof ApiRequestError) {
    return error.status === 502 || error.status === 503 || error.status === 504;
  }
  return false;
}

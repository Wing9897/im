/**
 * Network-level failures (unreachable backend, timeout, cancel).
 * Distinct from structured `ApiRequestError` HTTP failures.
 */

/**
 * Custom error class thrown when a network-level failure occurs
 * (e.g., backend unreachable, DNS failure, connection refused).
 * Exported so callers can distinguish connectivity issues from API errors.
 */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

/**
 * Error Toast Emitter — decoupled event bus for structured error toasts
 * without a React dependency at the call site.
 *
 * Preferred surfaces:
 * - Collector / runtime SSE failures (emit directly)
 * - Rare opt-in API calls via `ApiRequestOptions.emitErrorToast`
 *
 * Typical list GETs and page resources should NOT emit here; they use
 * ErrorRetryBanner / `useAsyncResource` error state. Command failures use
 * `handleCommandError` → ToastProvider.
 */

/**
 * Structured error event payload that matches the backend's error response format.
 */
export interface ErrorToastEvent {
  /** Error code from backend (e.g., "VALIDATION_ERROR", "COLLECTOR_UNAVAILABLE") */
  errorCode: string;
  /** Human-readable error description */
  message: string;
  /** Correlation ID for issue tracking (UUID string) */
  correlationId: string;
  /** Optional details object */
  details?: Record<string, unknown> | null;
}

type ErrorToastListener = (event: ErrorToastEvent) => void;

class ErrorToastEmitter {
  private listeners = new Set<ErrorToastListener>();

  /**
   * Subscribe to error toast events.
   * @returns Unsubscribe function.
   */
  on(listener: ErrorToastListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Emit an error toast event to all subscribers.
   */
  emit(event: ErrorToastEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

/**
 * Singleton error toast emitter — used by SSE handlers and opt-in API emits.
 */
export const errorToastEmitter = new ErrorToastEmitter();

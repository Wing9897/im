import { toError } from "./errors";
import { sleep } from "./sleep";


interface RetryOptions<T> {
  delays: readonly number[];
  shouldAbort?: () => boolean;
  abortValue?: () => T;
  shouldRetry?: (error: Error, attempt: number) => boolean;
  onError?: (error: Error, attempt: number) => void;
  fallbackErrorMessage?: string;
}

/**
 * Retries an async operation with configurable delays and abort semantics.
 * Throws the last encountered error if all attempts are exhausted.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions<T>,
): Promise<T> {
  const {
    delays,
    shouldAbort,
    abortValue,
    shouldRetry,
    onError,
    fallbackErrorMessage = "retry failed",
  } = options;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    if (shouldAbort?.()) {
      if (abortValue) {
        return abortValue();
      }
      throw new Error("retry aborted");
    }

    try {
      return await operation();
    } catch (error) {
      const normalizedError = toError(error);
      if (shouldAbort?.()) {
        if (abortValue) {
          return abortValue();
        }
        // Preserve the operation's typed cancellation error (for example
        // NetworkError from the HTTP client) instead of replacing it with an
        // untyped retry sentinel.
        throw normalizedError;
      }

      lastError = normalizedError;
      onError?.(normalizedError, attempt);

      const retryDelay = delays[attempt];
      if (
        retryDelay === undefined ||
        (shouldRetry && !shouldRetry(normalizedError, attempt))
      ) {
        break;
      }

      await sleep(retryDelay);
    }
  }

  throw lastError ?? new Error(fallbackErrorMessage);
}

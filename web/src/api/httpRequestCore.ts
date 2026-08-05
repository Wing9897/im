/**
 * Low-level URL / header / abort / fetch helpers for ApiClient.
 */

import { errorToastEmitter } from "./errorToastEmitter";
import {
  ApiRequestError,
  parseErrorResponse as parseApiErrorResponse,
} from "./parseApiError";
import { NetworkError } from "./httpErrors";
import { isAbortError } from "./httpRetry";

export const DEFAULT_TIMEOUT_MS = 30_000;

/** Optional per-request controls for REST methods. */
export interface ApiRequestOptions {
  signal?: AbortSignal;
  /** Override default 30s timeout. Use 0 to disable. */
  timeoutMs?: number;
  /**
   * When true, structured API errors are pushed to `errorToastEmitter`
   * (ErrorToast UI). Default false so typical list GETs only surface via
   * ErrorRetryBanner / local error state; command failures should use
   * `handleCommandError` → ToastProvider. Collector SSE failures still emit
   * directly on the emitter.
   */
  emitErrorToast?: boolean;
  /** Skip single-flight 401 refresh (used by refresh itself / public setup). */
  skipAuthRefresh?: boolean;
}

export function buildApiUrl(
  baseUrl: string,
  path: string,
  params?: Record<string, string | string[]>,
): string {
  const url = new URL(path, baseUrl);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== "") url.searchParams.append(key, item);
        }
        continue;
      }
      if (value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }
  return url.toString();
}

export function buildApiHeaders(
  accessToken: string | undefined,
  hasBody: boolean,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  return headers;
}

export function createRequestAbortSignal(
  external: AbortSignal | undefined,
  timeoutMs: number,
): { signal: AbortSignal | undefined; cleanup: () => void } {
  if (timeoutMs <= 0 && !external) {
    return { signal: undefined, cleanup: () => {} };
  }

  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  external?.addEventListener("abort", onExternalAbort);

  let timer: ReturnType<typeof setTimeout> | undefined;
  if (timeoutMs > 0) {
    timer = setTimeout(() => controller.abort(), timeoutMs);
  }

  if (external?.aborted) {
    controller.abort();
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      if (timer !== undefined) clearTimeout(timer);
      external?.removeEventListener("abort", onExternalAbort);
    },
  };
}

/** Perform fetch with timeout/abort mapping to NetworkError. */
export async function fetchWithMappedNetworkErrors(
  url: string,
  init: RequestInit,
  options?: ApiRequestOptions,
): Promise<Response> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const { signal, cleanup } = createRequestAbortSignal(options?.signal, timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal,
      headers: {
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  } catch (error) {
    if (isAbortError(error)) {
      if (options?.signal?.aborted) {
        throw new NetworkError("Request cancelled");
      }
      throw new NetworkError("Request timed out");
    }
    if (error instanceof TypeError) {
      // Network-level failure (DNS, connection refused, offline, etc.)
      throw new NetworkError("Backend unreachable");
    }
    throw error;
  } finally {
    cleanup();
  }
}

/** Map non-OK responses to ApiRequestError (optional toast). */
export async function throwForFailedResponse(
  response: Response,
  options?: ApiRequestOptions,
): Promise<never> {
  const { apiError, structured } = await parseApiErrorResponse(response);
  // Opt-in only — default suppress avoids double toast with ErrorRetryBanner.
  if (structured && options?.emitErrorToast) {
    errorToastEmitter.emit({
      errorCode: structured.error_code,
      message: structured.message,
      correlationId: structured.correlation_id,
      details: structured.details,
    });
  }
  throw new ApiRequestError(response.status, apiError, structured);
}

export async function readJsonBodyOrUndefined<T>(response: Response): Promise<T> {
  // HTTP 204 No Content — return undefined (cast as T for delete operations)
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

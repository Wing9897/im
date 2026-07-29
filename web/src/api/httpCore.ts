/**
 * Lean HTTP core for the IntelligenceMonitor REST API.
 * Auth refresh lives in `./authRefresh`; SSE transport in `./sseClient`.
 */

import {
  clearDeviceSession,
  getAccessToken,
  getRefreshToken,
  setAccessTokenOnly,
  saveDeviceSession,
} from "../domain/connection/connectionStore";
import { resolveBaseUrl } from "./baseUrl";
import { errorToastEmitter } from "./errorToastEmitter";
import {
  ApiRequestError,
  parseErrorResponse as parseApiErrorResponse,
  type ApiError,
} from "./parseApiError";
import {
  isSetupAuthPath,
  isStoredAccessExpired,
  refreshAccessTokenOnce,
} from "./authRefresh";
import {
  connectSSE as openSseConnection,
  type KnownSseEvent,
  type SseConnection,
  type SseEvent,
  type SseEventPayloadMap,
} from "./sseClient";
import { withRetry } from "../utils/retry";

export { ApiRequestError };
export type {
  ApiError,
  KnownSseEvent,
  SseConnection,
  SseEvent,
  SseEventPayloadMap,
};
export { resolveBaseUrl } from "./baseUrl";
export {
  isSetupAuthPath,
  isStoredAccessExpired,
  refreshAccessTokenOnce,
} from "./authRefresh";

const DEFAULT_TIMEOUT_MS = 30_000;
const GET_RETRY_DELAYS_MS = [400, 1_000] as const;

/** Optional per-request controls for REST methods. */
interface ApiRequestOptions {
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

/**
 * Lifecycle callbacks for `connectSSE`. The token-refresh gate is supplied by
 * the client itself, so callers only see the open/error edges.
 */
interface ApiSseOptions {
  /** Fires on every successful open, including after each reconnect. */
  onOpen?: () => void;
  onError?: (error: Event) => void;
}

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

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function shouldRetryGet(error: unknown): boolean {
  if (error instanceof NetworkError) {
    // Timeouts / explicit cancel should not hammer the server.
    return error.message === "Backend unreachable";
  }
  if (error instanceof ApiRequestError) {
    return error.status === 502 || error.status === 503 || error.status === 504;
  }
  return false;
}

/**
 * Unified HTTP client class providing typed methods for all REST API interactions.
 * Uses `fetch` for HTTP methods, injects Bearer token from the connection store,
 * and maps errors to a typed `ApiError` interface.
 */
export class ApiClient {
  private baseUrlOverride: string | null;

  constructor(baseUrl?: string) {
    this.baseUrlOverride = baseUrl ? baseUrl.replace(/\/+$/, "") : null;
  }

  /** Current API origin (runtime connection store unless constructed with override). */
  getBaseUrl(): string {
    return this.baseUrlOverride ?? resolveBaseUrl();
  }

  // ─── Token Management ───────────────────────────────────────────────

  /**
   * Update the Bearer access token. When a refresh token already exists, rotates
   * access only; otherwise stores access without inventing a fake refresh
   * (``hasDeviceSession`` stays false until a real pair is saved).
   */
  setToken(token: string): void {
    const trimmed = token.trim();
    if (!trimmed) {
      clearDeviceSession();
      return;
    }
    const refresh = getRefreshToken();
    if (refresh) {
      saveDeviceSession({ accessToken: trimmed, refreshToken: refresh });
      return;
    }
    setAccessTokenOnly(trimmed);
  }

  /** Remove stored device session tokens. */
  clearToken(): void {
    clearDeviceSession();
  }

  /** Get the currently stored access token from ``im:connection``. */
  getToken(): string | undefined {
    return getAccessToken();
  }

  // ─── HTTP Methods ───────────────────────────────────────────────────

  /**
   * Perform a GET request (idempotent; retries transient network / 502–504).
   * @param path - API path (e.g., "/api/v1/tasks")
   * @param params - Optional query parameters
   * @param options - Optional abort signal / timeout
   */
  async get<T>(
    path: string,
    params?: Record<string, string | string[]>,
    options?: ApiRequestOptions,
  ): Promise<T> {
    const url = this.buildUrl(path, params);
    return withRetry(() => this.request<T>(url, { method: "GET" }, options), {
      delays: GET_RETRY_DELAYS_MS,
      shouldAbort: () => options?.signal?.aborted === true,
      shouldRetry: (error) => shouldRetryGet(error),
    });
  }

  /**
   * Perform a GET request that returns the raw body as a Blob
   * (e.g., media proxy endpoints). Shares token injection and error
   * mapping (`ApiRequestError` / `NetworkError`) with the JSON methods.
   */
  async getBlob(path: string, options?: ApiRequestOptions): Promise<Blob> {
    const url = this.buildUrl(path);
    const response = await this.fetchResponse(
      url,
      { method: "GET", headers: { Accept: "*/*" } },
      options,
    );
    return response.blob();
  }

  /**
   * Perform a POST request.
   * @param path - API path
   * @param body - Optional request body (will be JSON-serialized)
   * @param options - Optional abort signal / timeout
   */
  async post<T>(
    path: string,
    body?: unknown,
    options?: ApiRequestOptions,
  ): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>(
      url,
      {
        method: "POST",
        body: body !== undefined ? JSON.stringify(body) : undefined,
      },
      options,
    );
  }

  /**
   * Perform a PUT request.
   * @param path - API path
   * @param body - Optional request body (will be JSON-serialized)
   * @param options - Optional abort signal / timeout
   */
  async put<T>(
    path: string,
    body?: unknown,
    options?: ApiRequestOptions,
  ): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>(
      url,
      {
        method: "PUT",
        body: body !== undefined ? JSON.stringify(body) : undefined,
      },
      options,
    );
  }

  /**
   * Perform a PATCH request.
   * @param path - API path
   * @param body - Optional request body (will be JSON-serialized)
   * @param options - Optional abort signal / timeout
   */
  async patch<T>(
    path: string,
    body?: unknown,
    options?: ApiRequestOptions,
  ): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>(
      url,
      {
        method: "PATCH",
        body: body !== undefined ? JSON.stringify(body) : undefined,
      },
      options,
    );
  }

  /**
   * Perform a DELETE request.
   * @param path - API path
   * @param options - Optional abort signal / timeout
   */
  async delete<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    const url = this.buildUrl(path);
    return this.request<T>(url, { method: "DELETE" }, options);
  }

  // ─── SSE (Server-Sent Events) ──────────────────────────────────────

  /**
   * Connect to the SSE events endpoint with auto-reconnect.
   * Delegates to `connectSSE` in `./sseClient`, supplying the resolved
   * events URL (including the auth token query param when available).
   *
   * @param onEvent - Callback invoked for each received SSE event
   * @param options - Lifecycle callbacks (`onOpen` fires on reconnects too)
   * @returns A handle whose `close()` ends the session
   */
  connectSSE(
    onEvent: (event: SseEvent) => void,
    options: ApiSseOptions = {},
  ): SseConnection {
    // Factory: reconnect must not reuse a stale access token in ?token=.
    // On drop: probe auth (EventSource cannot surface 401); refresh only when
    // needed; abort if still no access token — stops bare /events storms.
    return openSseConnection(() => this.buildSseUrl(), onEvent, {
      onOpen: options.onOpen,
      onError: options.onError,
      onBeforeReconnect: async (signal) => {
        if (signal.aborted) return false;
        const refresh = getRefreshToken();
        let access = getAccessToken();

        if (!access && refresh) {
          await refreshAccessTokenOnce();
          access = getAccessToken();
        }
        if (signal.aborted) return false;
        if (!access) return false;

        let needsRefresh = isStoredAccessExpired();
        if (!needsRefresh) {
          try {
            const probeUrl = new URL("/api/v1/setup/devices", this.getBaseUrl()).toString();
            const res = await fetch(probeUrl, {
              method: "GET",
              headers: { Authorization: `Bearer ${access}` },
              signal,
            });
            if (res.status === 401) needsRefresh = true;
          } catch {
            if (signal.aborted) return false;
          }
        }

        if (needsRefresh && refresh) {
          const ok = await refreshAccessTokenOnce();
          if (!ok) return false;
        }
        if (signal.aborted) return false;
        return Boolean(getAccessToken());
      },
    });
  }

  // ─── Private Helpers ────────────────────────────────────────────────

  private buildUrl(path: string, params?: Record<string, string | string[]>): string {
    const url = new URL(path, this.getBaseUrl());
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

  private buildSseUrl(): string {
    const url = new URL("/api/v1/events", this.getBaseUrl());
    const token = this.getToken();
    if (token) {
      // EventSource doesn't support custom headers, so pass token as query param
      url.searchParams.set("token", token);
    }
    return url.toString();
  }

  private buildHeaders(hasBody: boolean): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (hasBody) {
      headers["Content-Type"] = "application/json";
    }

    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
  }

  private createAbortSignal(
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

  private async request<T>(
    url: string,
    init: RequestInit,
    options?: ApiRequestOptions,
  ): Promise<T> {
    const response = await this.fetchResponse(url, init, options);

    // HTTP 204 No Content — return undefined (cast as T for delete operations)
    if (response.status === 204) {
      return undefined as T;
    }

    return response.json() as Promise<T>;
  }

  private async fetchResponse(
    url: string,
    init: RequestInit,
    options?: ApiRequestOptions,
    retried = false,
  ): Promise<Response> {
    const headers = this.buildHeaders(init.body !== undefined && init.body !== null);
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const { signal, cleanup } = this.createAbortSignal(options?.signal, timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        signal,
        headers: {
          ...headers,
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

    if (
      response.status === 401 &&
      !retried &&
      !options?.skipAuthRefresh &&
      !isSetupAuthPath(url) &&
      getRefreshToken()
    ) {
      const refreshed = await refreshAccessTokenOnce();
      if (refreshed) {
        return this.fetchResponse(url, init, options, true);
      }
    }

    if (!response.ok) {
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

    return response;
  }
}

/** Singleton API client instance for use across the application. */
export const apiClient = new ApiClient();

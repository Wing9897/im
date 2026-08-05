/**
 * Lean HTTP client for the IntelligenceMonitor REST API.
 * Auth refresh lives in `./authRefresh`; SSE transport in `./sseClient`.
 * Public façade: `./client`.
 */

import {
  clearDeviceSession,
  getAccessToken,
  getRefreshToken,
  setAccessTokenOnly,
  saveDeviceSession,
} from "../domain/connection/connectionStore";
import { resolveBaseUrl } from "./baseUrl";
import { refreshAccessTokenOnce } from "./authRefresh";
import {
  connectSSE as openSseConnection,
  type SseConnection,
  type SseEvent,
} from "./sseClient";
import { withRetry } from "../utils/retry";
import { NetworkError } from "./httpErrors";
import {
  createSseReconnectAuthGate,
  shouldAttemptAuthRefresh,
} from "./httpAuthRefresh";
import {
  buildApiHeaders,
  buildApiUrl,
  fetchWithMappedNetworkErrors,
  readJsonBodyOrUndefined,
  throwForFailedResponse,
  type ApiRequestOptions,
} from "./httpRequestCore";
import { GET_RETRY_DELAYS_MS, shouldRetryGet } from "./httpRetry";

export { NetworkError };
export type { ApiRequestOptions };

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
    return openSseConnection(() => this.buildSseUrl(), onEvent, {
      onOpen: options.onOpen,
      onError: options.onError,
      onBeforeReconnect: createSseReconnectAuthGate(() => this.getBaseUrl()),
    });
  }

  // ─── Private Helpers ────────────────────────────────────────────────

  private buildUrl(path: string, params?: Record<string, string | string[]>): string {
    return buildApiUrl(this.getBaseUrl(), path, params);
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

  private async request<T>(
    url: string,
    init: RequestInit,
    options?: ApiRequestOptions,
  ): Promise<T> {
    const response = await this.fetchResponse(url, init, options);
    return readJsonBodyOrUndefined<T>(response);
  }

  private async fetchResponse(
    url: string,
    init: RequestInit,
    options?: ApiRequestOptions,
    retried = false,
  ): Promise<Response> {
    const headers = buildApiHeaders(
      this.getToken(),
      init.body !== undefined && init.body !== null,
    );
    const response = await fetchWithMappedNetworkErrors(
      url,
      {
        ...init,
        headers: {
          ...headers,
          ...(init.headers as Record<string, string> | undefined),
        },
      },
      options,
    );

    if (
      shouldAttemptAuthRefresh(url, response.status, {
        skipAuthRefresh: options?.skipAuthRefresh,
        retried,
      })
    ) {
      const refreshed = await refreshAccessTokenOnce();
      if (refreshed) {
        return this.fetchResponse(url, init, options, true);
      }
    }

    if (!response.ok) {
      await throwForFailedResponse(response, options);
    }

    return response;
  }
}

/** Singleton API client instance for use across the application. */
export const apiClient = new ApiClient();

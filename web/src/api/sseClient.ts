/**
 * SSE (Server-Sent Events) client for the IntelligenceMonitor REST API.
 *
 * Extracted from `client.ts` to keep the HTTP core lean. Provides the
 * `connectSSE` helper with auto-reconnect, named-event listeners, and a
 * session handle whose close() stops reconnection.
 */

import type {
  AccountStatusChangedPayload,
  AnalysisCompletedPayload,
  AnalysisFailedPayload,
  AnalysisPausedChangedPayload,
  AnalysisStartedPayload,
  CollectorStatusChangedPayload,
  MessagesUpdatedPayload,
  ResourceModifiedPayload,
} from "../types";

const SSE_RECONNECT_DELAY_MS = 5000;
const SSE_MAX_RECONNECT_DELAY_MS = 60_000;
const SSE_RECONNECT_BACKOFF_FACTOR = 1.5;

/**
 * SSE event received from the server.
 */
export interface SseEvent<TData = unknown, TEvent extends string = string> {
  /** The event type name (e.g., "messages_updated", "analysis_started") */
  event: TEvent;
  /** The parsed JSON payload data */
  data: TData;
}

export interface SseEventPayloadMap {
  messages_updated: MessagesUpdatedPayload;
  collector_status_changed: CollectorStatusChangedPayload;
  account_status_changed: AccountStatusChangedPayload;
  analysis_started: AnalysisStartedPayload;
  analysis_completed: AnalysisCompletedPayload;
  analysis_failed: AnalysisFailedPayload;
  analysis_paused_changed: AnalysisPausedChangedPayload;
  resource_modified: ResourceModifiedPayload;
}

export type KnownSseEvent = {
  [TEvent in keyof SseEventPayloadMap]: SseEvent<SseEventPayloadMap[TEvent], TEvent>;
}[keyof SseEventPayloadMap];

export type SseUrlSource = string | (() => string);

/**
 * Return false to abort further reconnects (e.g. auth cleared).
 * ``signal`` is aborted when the SSE session is closed — cancel in-flight probes.
 */
export type SseBeforeReconnect = (signal: AbortSignal) => boolean | Promise<boolean>;

/**
 * Handle on an SSE session, not on one EventSource: the loop swaps the
 * underlying source on every reconnect, so the handle only exposes what stays
 * meaningful across those swaps.
 */
export interface SseConnection {
  /** Close the live source and cancel any pending reconnect. */
  close: () => void;
}

/**
 * Lifecycle callbacks for an SSE session.
 */
export interface SseConnectOptions {
  /** Fires on every successful open, including after each reconnect. */
  onOpen?: () => void;
  onError?: (error: Event) => void;
  /** Gate before each reconnect (refresh / abort). */
  onBeforeReconnect?: SseBeforeReconnect;
}

function resolveSseUrl(urlOrFactory: SseUrlSource): string {
  return typeof urlOrFactory === "function" ? urlOrFactory() : urlOrFactory;
}

function sseUrlHasToken(url: string): boolean {
  try {
    return Boolean(new URL(url).searchParams.get("token")?.trim());
  } catch {
    return url.includes("token=");
  }
}

/**
 * Connect to the SSE events endpoint with auto-reconnect.
 *
 * On disconnection, reconnects automatically with a growing backoff. The
 * returned handle stays valid across reconnects — the live EventSource is kept
 * internal so no caller can end up holding a dead one.
 *
 * Prefer a URL factory so reconnects pick up a refreshed access token
 * (EventSource cannot send Authorization headers — only ``?token=``).
 *
 * @param urlOrFactory - Fully-built SSE URL, or factory re-evaluated on each connect
 * @param onEvent - Callback invoked for each received SSE event
 * @param options - Lifecycle callbacks (`onOpen` / `onError` / `onBeforeReconnect`)
 * @returns A handle whose `close()` ends the session
 */
export function connectSSE(
  urlOrFactory: SseUrlSource,
  onEvent: (event: SseEvent) => void,
  options: SseConnectOptions = {},
): SseConnection {
  const { onOpen, onError, onBeforeReconnect } = options;
  let eventSource = new EventSource(resolveSseUrl(urlOrFactory));
  let closed = false;
  let retryDelayMs = SSE_RECONNECT_DELAY_MS;
  let reconnectAbort = new AbortController();
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const resetRetryDelay = () => {
    retryDelayMs = SSE_RECONNECT_DELAY_MS;
  };

  const scheduleReconnect = () => {
    const jitterMs = Math.floor(Math.random() * 1000);
    const delayMs = retryDelayMs + jitterMs;
    const signal = reconnectAbort.signal;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void (async () => {
        if (closed || signal.aborted) return;
        if (onBeforeReconnect) {
          let proceed = false;
          try {
            proceed = await onBeforeReconnect(signal);
          } catch {
            proceed = false;
          }
          if (!proceed || closed || signal.aborted) {
            closed = true;
            return;
          }
        }
        if (closed || signal.aborted) return;
        // Rebuild URL each attempt — stale ?token= after refresh causes endless 401.
        const nextUrl = resolveSseUrl(urlOrFactory);
        if (!sseUrlHasToken(nextUrl)) {
          // Bare /events 401-loops once localhost_auth_exempt is false.
          closed = true;
          return;
        }
        eventSource = new EventSource(nextUrl);
        attachHandlers(eventSource);
      })();
    }, delayMs);
    retryDelayMs = Math.min(
      SSE_MAX_RECONNECT_DELAY_MS,
      Math.round(retryDelayMs * SSE_RECONNECT_BACKOFF_FACTOR),
    );
  };

  const handleMessage = (e: MessageEvent) => {
    resetRetryDelay();
    try {
      const data: unknown = JSON.parse(e.data as string);
      // SSE data is serialized with { type, payload } wrapper by the backend.
      // Extract the payload for named events, pass raw data for generic messages.
      const payload =
        data && typeof data === "object" && "payload" in data
          ? (data as Record<string, unknown>).payload
          : data;
      onEvent({ event: e.type === "message" ? "message" : e.type, data: payload });
    } catch {
      // If data isn't valid JSON, pass as raw string
      onEvent({ event: e.type === "message" ? "message" : e.type, data: e.data });
    }
  };

  const handleError = (e: Event) => {
    if (closed) return;
    onError?.(e);

    eventSource.close();
    scheduleReconnect();
  };

  const attachHandlers = (source: EventSource) => {
    source.onmessage = handleMessage;
    source.onerror = handleError;
    source.onopen = () => {
      resetRetryDelay();
      onOpen?.();
    };

    // Listen for named event types from the server
    const eventTypes = [
      "messages_updated",
      "collector_status_changed",
      "account_status_changed",
      "analysis_started",
      "analysis_completed",
      "analysis_failed",
      "analysis_paused_changed",
      "resource_modified",
    ];
    for (const type of eventTypes) {
      source.addEventListener(type, (e: Event) => {
        resetRetryDelay();
        const messageEvent = e as MessageEvent;
        try {
          const data: unknown = JSON.parse(messageEvent.data as string);
          // SSE data is serialized with { type, payload } wrapper by the backend.
          const payload =
            data && typeof data === "object" && "payload" in data
              ? (data as Record<string, unknown>).payload
              : data;
          onEvent({ event: type, data: payload });
        } catch {
          onEvent({ event: type, data: messageEvent.data });
        }
      });
    }
  };

  attachHandlers(eventSource);

  return {
    close: () => {
      closed = true;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      reconnectAbort.abort();
      reconnectAbort = new AbortController();
      // Whichever source the loop swapped in last.
      eventSource.close();
    },
  };
}

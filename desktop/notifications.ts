import { Notification, BrowserWindow } from 'electron';
import http from 'node:http';
import { getProductName, getShellCopy, setShellLocale } from './shell-i18n';

/**
 * Configuration for the analysis notifications module.
 */
export interface NotificationConfig {
  /** Base URL of the server SSE endpoint. Default: http://localhost:18820 */
  serverUrl?: string;
  /** Whether analysis notifications are enabled. Default: true */
  enabled?: boolean;
  /**
   * Device access token for SSE after bootstrap (localhost_auth_exempt=false).
   * Usually pushed later via ``setAnalysisNotificationAuth`` from the renderer.
   */
  accessToken?: string | null;
  /** UI locale pushed from renderer (`zh-Hant` | `zh-Hans` | `en`). */
  locale?: string | null;
}

/** Parsed SSE event from the server stream */
export interface SseMessage {
  event: string;
  data: string;
}

/** Payload for analysis_completed SSE event */
export interface AnalysisCompletedPayload {
  taskId: string;
  taskName?: string;
  batchId: string;
  analysisMode?: string;
  findingsCount?: number;
  hasFindings?: boolean;
}

/** Payload for analysis_failed SSE event */
export interface AnalysisFailedPayload {
  taskId: string;
  taskName?: string;
  batchId: string;
  error: string;
  retrying?: boolean;
  currentRetry?: number;
  maxRetries?: number;
}

/** Internal state for the notification listener */
let currentRequest: ReturnType<typeof http.get> | null = null;
let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let enabled = true;
let mainWindowRef: BrowserWindow | null = null;
let serverBaseUrl = 'http://localhost:18820';
let accessToken: string | null = null;
/** After 401/403, stop reconnect storms until renderer pushes a new token. */
let authBlocked = false;

/** Reconnect delay in milliseconds */
const RECONNECT_DELAY_MS = 5000;

/**
 * Checks whether the main BrowserWindow is currently visible and focused.
 * If yes, notifications should be suppressed to avoid redundant UI.
 */
export function isWindowVisibleAndFocused(): boolean {
  if (!mainWindowRef || mainWindowRef.isDestroyed()) {
    return false;
  }
  return mainWindowRef.isVisible() && mainWindowRef.isFocused();
}

function notificationCopy() {
  const copy = getShellCopy();
  return {
    completed: copy.analysisCompleted,
    failed: copy.analysisFailed,
    unknownError: copy.unknownError,
  };
}

/**
 * Shows a native OS notification for a completed analysis event.
 */
export function showCompletedNotification(payload: AnalysisCompletedPayload): void {
  if (!enabled) return;
  if (isWindowVisibleAndFocused()) return;
  if (!Notification.isSupported()) return;

  const taskName = payload.taskName || payload.taskId;
  const notification = new Notification({
    title: getProductName(),
    body: `${taskName} — ${notificationCopy().completed}`,
  });
  notification.show();
}

/**
 * Shows a native OS notification for a failed analysis event.
 */
export function showFailedNotification(payload: AnalysisFailedPayload): void {
  if (!enabled) return;
  if (isWindowVisibleAndFocused()) return;
  if (!Notification.isSupported()) return;

  const copy = notificationCopy();
  const taskName = payload.taskName || payload.taskId;
  const reason = payload.error || copy.unknownError;
  // Truncate long error messages for notification body
  const reasonSummary = reason.length > 80 ? reason.substring(0, 77) + '...' : reason;
  const notification = new Notification({
    title: getProductName(),
    body: `${taskName} — ${copy.failed}: ${reasonSummary}`,
  });
  notification.show();
}

/**
 * Handles a parsed SSE message, dispatching to the appropriate notification handler.
 */
export function handleSseMessage(message: SseMessage): void {
  let parsed: { payload?: unknown };
  try {
    parsed = JSON.parse(message.data);
  } catch {
    return;
  }

  if (message.event === 'analysis_completed') {
    showCompletedNotification(parsed.payload as AnalysisCompletedPayload);
  } else if (message.event === 'analysis_failed') {
    showFailedNotification(parsed.payload as AnalysisFailedPayload);
  }
}

function clearReconnectTimer(): void {
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
}

function destroyCurrentRequest(): void {
  if (currentRequest) {
    currentRequest.destroy();
    currentRequest = null;
  }
}

/**
 * Connects to the server SSE endpoint and listens for analysis events.
 * Requires a device access token once localhost auth exempt is disabled.
 */
function connectSse(): void {
  if (!enabled || authBlocked) return;

  const token = accessToken?.trim();
  if (!token) {
    // Do not hit /api/v1/events bare — after bootstrap that 401-loops every 5s.
    return;
  }

  destroyCurrentRequest();

  let parsed: URL;
  try {
    parsed = new URL('/api/v1/events', serverBaseUrl.endsWith('/') ? serverBaseUrl : `${serverBaseUrl}/`);
  } catch {
    scheduleReconnect();
    return;
  }

  const req = http.get(
    {
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port || undefined,
      path: `${parsed.pathname}${parsed.search}`,
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${token}`,
      },
    },
    (res) => {
      if (res.statusCode === 401 || res.statusCode === 403) {
        res.resume();
        authBlocked = true;
        destroyCurrentRequest();
        clearReconnectTimer();
        console.warn(
          '[notifications] SSE auth failed (401/403); paused until renderer sends a new access token',
        );
        return;
      }

      if (res.statusCode !== 200) {
        res.resume();
        scheduleReconnect();
        return;
      }

      let buffer = '';
      let currentEvent = '';
      let currentData = '';

      res.setEncoding('utf8');
      res.on('data', (chunk: string) => {
        buffer += chunk;

        // Process complete lines from the buffer
        const lines = buffer.split('\n');
        // Keep the last incomplete line in the buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            currentData = line.slice(5).trim();
          } else if (line === '' || line === '\r') {
            // Empty line marks end of an event
            if (currentEvent && currentData) {
              handleSseMessage({ event: currentEvent, data: currentData });
            }
            currentEvent = '';
            currentData = '';
          }
          // Ignore comment lines (starting with ':')
        }
      });

      res.on('end', () => {
        scheduleReconnect();
      });

      res.on('error', () => {
        scheduleReconnect();
      });
    },
  );

  req.on('error', () => {
    scheduleReconnect();
  });

  currentRequest = req;
}

/**
 * Schedules a reconnection attempt after a delay.
 */
function scheduleReconnect(): void {
  if (!enabled || authBlocked || !accessToken?.trim()) return;
  clearReconnectTimer();
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    if (enabled && !authBlocked && accessToken?.trim()) {
      connectSse();
    }
  }, RECONNECT_DELAY_MS);
}

/**
 * Push / clear the device access token used for main-process notification SSE.
 * Called from the renderer over IPC whenever ``im:connection`` changes.
 */
export function setAnalysisNotificationAuth(token: string | null | undefined): void {
  const next = (token ?? '').trim() || null;
  const changed = next !== accessToken;
  accessToken = next;
  authBlocked = false;

  if (!enabled) return;

  if (!next) {
    destroyCurrentRequest();
    clearReconnectTimer();
    return;
  }

  if (changed || !currentRequest) {
    clearReconnectTimer();
    connectSse();
  }
}

/** Push UI locale for native notification + desktop shell copy (renderer → main). */
export function setAnalysisNotificationLocale(locale: string | null | undefined): void {
  setShellLocale(locale);
}

/**
 * Initializes the analysis notification listener.
 *
 * Connects to the server's SSE endpoint and listens for `analysis_completed`
 * and `analysis_failed` events. Shows native OS notifications when the window
 * is not visible and focused.
 *
 * SSE stays idle until ``accessToken`` is provided (config or
 * ``setAnalysisNotificationAuth``), avoiding 401 reconnect storms after
 * bootstrap disables localhost auth exempt.
 *
 * @param window - The main BrowserWindow instance (used for focus/visibility check)
 * @param config - Optional configuration for the notification system
 */
export function initAnalysisNotifications(
  window: BrowserWindow,
  config?: NotificationConfig,
): void {
  mainWindowRef = window;

  if (config?.serverUrl) {
    serverBaseUrl = config.serverUrl;
  }

  if (config?.enabled !== undefined) {
    enabled = config.enabled;
  }

  if (config?.accessToken !== undefined) {
    accessToken = (config.accessToken ?? '').trim() || null;
  }

  if (config?.locale !== undefined) {
    setShellLocale(config.locale);
  }

  authBlocked = false;

  if (enabled) {
    connectSse();
  }
}

/**
 * Stops the SSE listener and cleans up resources, restoring module defaults.
 */
export function stopAnalysisNotifications(): void {
  destroyCurrentRequest();
  clearReconnectTimer();
  mainWindowRef = null;
  enabled = true;
  accessToken = null;
  authBlocked = false;
  serverBaseUrl = 'http://localhost:18820';
}

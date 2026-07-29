import {
  createAiEngineStatusPoller,
  createCollectorStatusPoller,
  createQueueStatusPoller,
} from "./statusPollers";
import type { RuntimeStateBundle } from "./stateManagement";
import {
  AI_STATUS_REFRESH_INTERVAL_MS,
  COLLECTOR_STATUS_REFRESH_INTERVAL_MS,
  EVENT_LOG_REFRESH_DELAY_MS,
  QUEUE_STATUS_REFRESH_INTERVAL_MS,
  STORED_LOG_REFRESH_INTERVAL_MS,
} from "./types";
import type { RuntimeMonitoringOptions } from "./types";

// ---------------------------------------------------------------------------
// Interval-based monitoring orchestration (pollers in statusPollers.ts)
// ---------------------------------------------------------------------------

interface IntervalMonitorDeps {
  state: RuntimeStateBundle;
  options: RuntimeMonitoringOptions;
}

interface IntervalMonitorResult {
  refreshQueueStatus: (logPauseChanges: boolean) => void;
  refreshAiStatus: (logOnChange: boolean) => void;
  refreshLogsForBackendEvent: () => void;
  cleanup: () => void;
  bootstrap: () => Promise<void>;
}

/**
 * Sets up the serialized async runners for AI status and queue status polling,
 * the bootstrap sequence, and periodic interval timers.
 *
 * Returns control functions and a cleanup function.
 */
export function setupIntervalMonitor({
  state,
  options,
}: IntervalMonitorDeps): IntervalMonitorResult {
  const { refreshStoredLogs } = options;
  let mounted = true;
  const isMounted = () => mounted;

  const { refreshQueueStatusAsync } = createQueueStatusPoller(state, options, isMounted);
  const { refreshAiStatusAsync } = createAiEngineStatusPoller(state, options, isMounted);
  const { bootstrapCollectorStatus, refreshCollectorStatus } =
    createCollectorStatusPoller(state, options, isMounted);

  const refreshLogsForBackendEvent = () => {
    void refreshStoredLogs();
    if (state.eventLogRefreshTimerRef.current !== null) {
      window.clearTimeout(state.eventLogRefreshTimerRef.current);
    }
    state.eventLogRefreshTimerRef.current = window.setTimeout(() => {
      state.eventLogRefreshTimerRef.current = null;
      void refreshStoredLogs();
    }, EVENT_LOG_REFRESH_DELAY_MS);
  };

  const refreshQueueStatus = (logPauseChanges: boolean) => {
    void refreshQueueStatusAsync(logPauseChanges);
  };

  const refreshAiStatus = (logOnChange: boolean) => {
    void refreshAiStatusAsync(logOnChange);
  };

  // Assign to refs so external callers (useCallback wrappers) can invoke them
  state.refreshQueueStatusRef.current = (logPauseChanges = false) => {
    refreshQueueStatus(logPauseChanges);
  };
  state.refreshAiStatusRef.current = (logOnChange = true) => {
    refreshAiStatus(logOnChange);
  };

  const bootstrap = async () => {
    void refreshStoredLogs();
    await bootstrapCollectorStatus();
    await refreshQueueStatusAsync(false);
    void refreshAiStatusAsync(false);
  };

  // Periodic timers
  const aiTimer = window.setInterval(() => {
    void refreshAiStatusAsync(true);
  }, AI_STATUS_REFRESH_INTERVAL_MS);
  const logTimer = window.setInterval(() => {
    if (!document.hidden) {
      void refreshStoredLogs();
    }
  }, STORED_LOG_REFRESH_INTERVAL_MS);
  const queueTimer = window.setInterval(() => {
    if (!document.hidden) {
      void refreshQueueStatusAsync(false);
    }
  }, QUEUE_STATUS_REFRESH_INTERVAL_MS);
  const collectorTimer = window.setInterval(() => {
    if (!document.hidden) {
      void refreshCollectorStatus();
    }
  }, COLLECTOR_STATUS_REFRESH_INTERVAL_MS);

  const cleanup = () => {
    mounted = false;
    state.refreshAiStatusRef.current = () => {};
    state.refreshQueueStatusRef.current = () => {};
    if (state.eventLogRefreshTimerRef.current !== null) {
      window.clearTimeout(state.eventLogRefreshTimerRef.current);
      state.eventLogRefreshTimerRef.current = null;
    }
    window.clearInterval(aiTimer);
    window.clearInterval(logTimer);
    window.clearInterval(queueTimer);
    window.clearInterval(collectorTimer);
  };

  return {
    refreshQueueStatus,
    refreshAiStatus,
    refreshLogsForBackendEvent,
    cleanup,
    bootstrap,
  };
}

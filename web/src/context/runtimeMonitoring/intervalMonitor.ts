import { hasRuntimeInterest } from "./consumerInterest";
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
// Visibility-aware single-tick scheduler (replaces 4× setInterval)
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

type ScheduledJob = {
  id: string;
  intervalMs: number;
  /** When true, skip ticks while the document is hidden (tab backgrounded). */
  pauseWhenHidden: boolean;
  lastRunAt: number;
  run: () => void;
};

/**
 * Sets up pollers, bootstrap, and one visibility-aware scheduler tick.
 *
 * Non-visible tabs pause log / queue / collector / AI status polls to cut
 * background traffic; SSE remains the live path while a device session exists.
 * Interval jobs also skip when no consumer has acquired interest for that kind
 * (e.g. stored-log polling only while the Logs page is mounted).
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
    // Event-driven + interval log sync only while a Logs consumer is mounted.
    if (!hasRuntimeInterest("logs")) return;
    void refreshStoredLogs();
    if (state.eventLogRefreshTimerRef.current !== null) {
      window.clearTimeout(state.eventLogRefreshTimerRef.current);
    }
    state.eventLogRefreshTimerRef.current = window.setTimeout(() => {
      state.eventLogRefreshTimerRef.current = null;
      if (!hasRuntimeInterest("logs")) return;
      void refreshStoredLogs();
    }, EVENT_LOG_REFRESH_DELAY_MS);
  };

  const refreshQueueStatus = (logPauseChanges: boolean) => {
    void refreshQueueStatusAsync(logPauseChanges);
  };

  const refreshAiStatus = (logOnChange: boolean) => {
    void refreshAiStatusAsync(logOnChange);
  };

  state.refreshQueueStatusRef.current = (logPauseChanges = false) => {
    refreshQueueStatus(logPauseChanges);
  };
  state.refreshAiStatusRef.current = (logOnChange = true) => {
    refreshAiStatus(logOnChange);
  };

  const bootstrap = async () => {
    // Chrome always needs queue/AI/collector; stored logs wait for a Logs consumer.
    if (hasRuntimeInterest("logs")) {
      void refreshStoredLogs();
    }
    await bootstrapCollectorStatus();
    await refreshQueueStatusAsync(false);
    void refreshAiStatusAsync(false);
  };

  const now = Date.now();
  const jobs: ScheduledJob[] = [
    {
      id: "ai",
      intervalMs: AI_STATUS_REFRESH_INTERVAL_MS,
      pauseWhenHidden: true,
      lastRunAt: now,
      run: () => {
        void refreshAiStatusAsync(true);
      },
    },
    {
      id: "logs",
      intervalMs: STORED_LOG_REFRESH_INTERVAL_MS,
      pauseWhenHidden: true,
      lastRunAt: now,
      run: () => {
        if (!hasRuntimeInterest("logs")) return;
        void refreshStoredLogs();
      },
    },
    {
      id: "queue",
      intervalMs: QUEUE_STATUS_REFRESH_INTERVAL_MS,
      pauseWhenHidden: true,
      lastRunAt: now,
      run: () => {
        void refreshQueueStatusAsync(false);
      },
    },
    {
      id: "collector",
      intervalMs: COLLECTOR_STATUS_REFRESH_INTERVAL_MS,
      pauseWhenHidden: true,
      lastRunAt: now,
      run: () => {
        void refreshCollectorStatus();
      },
    },
  ];

  // Shared tick: gcd-friendly 5s cadence; each job enforces its own interval.
  const SCHEDULER_TICK_MS = 5_000;
  const schedulerTimer = window.setInterval(() => {
    if (document.hidden) return;
    const tickNow = Date.now();
    for (const job of jobs) {
      if (job.pauseWhenHidden && document.hidden) continue;
      if (tickNow - job.lastRunAt < job.intervalMs) continue;
      job.lastRunAt = tickNow;
      job.run();
    }
  }, SCHEDULER_TICK_MS);

  const cleanup = () => {
    mounted = false;
    state.refreshAiStatusRef.current = () => {};
    state.refreshQueueStatusRef.current = () => {};
    if (state.eventLogRefreshTimerRef.current !== null) {
      window.clearTimeout(state.eventLogRefreshTimerRef.current);
      state.eventLogRefreshTimerRef.current = null;
    }
    window.clearInterval(schedulerTimer);
  };

  return {
    refreshQueueStatus,
    refreshAiStatus,
    refreshLogsForBackendEvent,
    cleanup,
    bootstrap,
  };
}

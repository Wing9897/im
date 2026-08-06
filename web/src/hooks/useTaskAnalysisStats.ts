import { useCallback, useEffect, useRef, useState } from "react";

import { fetchTaskAnalysisStats } from "../api/results";
import { useAnalysisStatus } from "../context/AnalysisStatusContext";
import type { TaskAnalysisStats } from "../types";
import { logWarn } from "../utils/logger";
import { useLatestRequest } from "./useLatestRequest";
import { useRefreshOnAnalysisEvent } from "./useRefreshOnAnalysisEvent";

// ── Retry constants ──────────────────────────────────────────────────────────

/** Maximum number of retries after an event-triggered fetch returns stale data. */
const MAX_RETRIES = 3;

/** Delay in ms between retries (allows DB commit to complete). */
const RETRY_DELAY_MS = 1500;

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Sum of unanalyzedCount across all task stats — used as a staleness sentinel. */
function totalUnanalyzed(stats: TaskAnalysisStats[]): number {
  return stats.reduce((sum, t) => sum + t.unanalyzedCount, 0);
}

// ── Options / Result ─────────────────────────────────────────────────────────

interface UseTaskAnalysisStatsOptions {
  /** Time range filter passed to the API. */
  timeRange: string;
  /** If set, auto-refresh on this interval (ms). */
  refreshIntervalMs?: number;
  /** Log prefix for warning messages. */
  logPrefix?: string;
  /**
   * When false, skip the built-in analysis-event SSE subscription so a parent
   * hook can call {@link notifyAnalysisEvent} from a combined refresh handler.
   */
  refreshOnAnalysisEvents?: boolean;
}

interface UseTaskAnalysisStatsResult {
  taskStats: TaskAnalysisStats[];
  refreshTaskStats: () => void;
  /** Snapshot + fetch with stale-data retry — use from a parent SSE handler. */
  notifyAnalysisEvent: () => void;
}

/**
 * Shared hook that fetches per-task analysis statistics with stale-request
 * guarding and automatic refresh on analysis events.
 *
 * After an analysis event triggers a fetch, if the returned data has the same
 * total unanalyzedCount as the pre-event snapshot (DB write-commit race), the
 * hook schedules up to MAX_RETRIES retries at RETRY_DELAY_MS intervals and
 * stops as soon as the data changes or retries are exhausted.
 */
export function useTaskAnalysisStats(
  options: UseTaskAnalysisStatsOptions,
): UseTaskAnalysisStatsResult {
  const { timeRange, refreshIntervalMs, logPrefix = "[task-stats]", refreshOnAnalysisEvents = true } = options;
  const [taskStats, setTaskStats] = useState<TaskAnalysisStats[]>([]);
  const statsRequest = useLatestRequest();

  // ── Retry state (refs — never trigger re-renders) ───────────────────────
  /** Sum of unanalyzedCount before the current event cycle began. -1 = no active cycle. */
  const preEventCountRef = useRef<number>(-1);
  /** Number of retries attempted in the current event cycle. */
  const retryCountRef = useRef<number>(0);
  /** Pending retry timer id. null when idle. */
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelRetry = useCallback(() => {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  // ── Core fetch ───────────────────────────────────────────────────────────

  const fetchTaskStats = useCallback(
    async () => {
      // Cancel any in-flight retry timer before starting a new fetch.
      cancelRetry();

      const request = statsRequest.begin();
      try {
        const newStats = await fetchTaskAnalysisStats(timeRange);

        if (!statsRequest.isCurrent(request)) {
          return; // stale request — discard
        }

        // Defensive: ensure newStats is an array (API may return non-array on error)
        const safeStats = Array.isArray(newStats) ? newStats : [];

        const inEventCycle = preEventCountRef.current !== -1;
        const newUnanalyzed = totalUnanalyzed(safeStats);
        const stale =
          inEventCycle && newUnanalyzed === preEventCountRef.current;

        // Retry only when there is unanalyzed work that might still be committing.
        // agent ticks leave unanalyzed at 0 — retrying only multiplies
        // /results/stats traffic with no benefit.
        if (stale && newUnanalyzed > 0 && retryCountRef.current < MAX_RETRIES) {
          // Data unchanged — schedule a retry and leave state as-is.
          retryCountRef.current += 1;
          retryTimerRef.current = setTimeout(() => {
            void fetchTaskStats();
          }, RETRY_DELAY_MS);
        } else {
          // Data changed OR not in event cycle OR retries exhausted — commit state.
          setTaskStats(safeStats);
          preEventCountRef.current = -1;
        }
      } catch (error) {
        if (statsRequest.isCurrent(request)) {
          logWarn(`${logPrefix} failed to refresh task stats`, error);
          // Errors do not trigger retries — avoids amplifying transient failures.
          preEventCountRef.current = -1;
        }
      }
    },
    [cancelRetry, statsRequest, timeRange, logPrefix],
  );

  const refreshTaskStats = useCallback(() => {
    void fetchTaskStats();
  }, [fetchTaskStats]);

  // ── Initial fetch ────────────────────────────────────────────────────────

  useEffect(() => {
    void fetchTaskStats();
  }, [fetchTaskStats]);

  // ── Optional periodic refresh ────────────────────────────────────────────

  useEffect(() => {
    if (!refreshIntervalMs) return;
    const timer = window.setInterval(() => {
      void fetchTaskStats();
    }, refreshIntervalMs);
    return () => window.clearInterval(timer);
  }, [fetchTaskStats, refreshIntervalMs]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      cancelRetry();
      preEventCountRef.current = -1;
    };
  }, [cancelRetry]);

  // ── Refresh on analysis events (two-phase: snapshot → fetch) ────────────

  const taskStatsRef = useRef(taskStats);
  taskStatsRef.current = taskStats;

  const onAnalysisEvent = useCallback(() => {
    // Snapshot current state before the fetch (ref avoids stale closure).
    preEventCountRef.current = taskStatsRef.current.reduce(
      (sum, t) => sum + t.unanalyzedCount,
      0,
    );
    retryCountRef.current = 0;
    // Then fetch.
    void fetchTaskStats();
  }, [fetchTaskStats]);

  const onAnalysisEventWhenEnabled = useCallback(() => {
    if (!refreshOnAnalysisEvents) return;
    onAnalysisEvent();
  }, [onAnalysisEvent, refreshOnAnalysisEvents]);

  // When parent owns SSE (refreshOnAnalysisEvents=false), disable matching so we
  // neither log-fire nor call the no-op callback on every analysis event.
  useRefreshOnAnalysisEvent(onAnalysisEventWhenEnabled, {
    includeStarted: refreshOnAnalysisEvents,
    includeCompleted: refreshOnAnalysisEvents,
    includeFailed: refreshOnAnalysisEvents,
  });

  // ── Refresh on messages_updated SSE events ──────────────────────────────

  const { lastMessagesUpdate } = useAnalysisStatus();

  /** Tracks whether a messages_updated refresh is currently in-flight. */
  const messagesRefreshInFlightRef = useRef(false);
  /** Same receivedAt must not re-fetch when `fetchTaskStats` identity churns. */
  const lastHandledMessagesAtRef = useRef<number | null>(null);
  const fetchTaskStatsRef = useRef(fetchTaskStats);
  fetchTaskStatsRef.current = fetchTaskStats;

  useEffect(() => {
    if (!lastMessagesUpdate) return;

    if (lastHandledMessagesAtRef.current === lastMessagesUpdate.receivedAt) return;
    lastHandledMessagesAtRef.current = lastMessagesUpdate.receivedAt;

    // Deduplicate: skip if a messages_updated refresh is already in-flight
    if (messagesRefreshInFlightRef.current) return;

    messagesRefreshInFlightRef.current = true;

    // Snapshot current state and trigger fetch with stale-data retry
    preEventCountRef.current = taskStatsRef.current.reduce(
      (sum, t) => sum + t.unanalyzedCount,
      0,
    );
    retryCountRef.current = 0;

    void fetchTaskStatsRef.current().finally(() => {
      messagesRefreshInFlightRef.current = false;
    });
  }, [lastMessagesUpdate]);

  return { taskStats, refreshTaskStats, notifyAnalysisEvent: onAnalysisEvent };
}

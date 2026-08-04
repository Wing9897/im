import { useEffect, useRef } from "react";

import { useAnalysisStatus } from "../context/AnalysisStatusContext";
import type { RuntimeAnalysisEvent } from "../context/runtimeMonitoring";
import type { AnalysisMode } from "../types";
import { logWarn } from "../utils/logger";

export interface UseRefreshOnAnalysisEventOptions {
  includeStarted?: boolean;
  includeCompleted?: boolean;
  includeFailed?: boolean;
  taskId?: string | null;
  /** When set, wins over single `taskId`. `null`/omit = any task; `[]` = none. */
  taskIds?: string[] | null;
  /** Single mode or any-of list (e.g. Intelligence: event + web_intel). */
  analysisMode?: AnalysisMode | readonly AnalysisMode[];
}

function analysisModeMatches(
  eventMode: string | null | undefined,
  filter: AnalysisMode | readonly AnalysisMode[] | undefined,
): boolean {
  if (filter == null) return true;
  if (Array.isArray(filter)) {
    if (filter.length === 0) return false;
    return eventMode != null && (filter as readonly string[]).includes(eventMode);
  }
  return eventMode === filter;
}

/** Determines whether a given analysis event matches the refresh filter criteria. */
export function shouldRefreshForEvent(
  event: RuntimeAnalysisEvent,
  {
    includeStarted = false,
    includeCompleted = true,
    includeFailed = false,
    taskId,
    taskIds,
    analysisMode,
  }: UseRefreshOnAnalysisEventOptions,
): boolean {
  if (taskIds !== undefined && taskIds !== null) {
    if (taskIds.length === 0) return false;
    if (!event.payload.taskId || !taskIds.includes(event.payload.taskId)) {
      return false;
    }
  } else if (taskId && event.payload.taskId !== taskId) {
    return false;
  }

  if (event.type === "started") {
    return includeStarted;
  }

  if (event.type === "failed") {
    return includeFailed;
  }

  if (!includeCompleted) {
    return false;
  }

  if (!analysisModeMatches(event.payload.analysisMode, analysisMode)) {
    return false;
  }

  return true;
}

/**
 * Calls `onRefresh` once per matching analysis event (`receivedAt`).
 *
 * `onRefresh` is read from a ref so identity churn (e.g. after stats state
 * updates) cannot re-fire the same SSE event in a tight loop.
 */
export function useRefreshOnAnalysisEvent(
  onRefresh: () => void | Promise<void>,
  options: UseRefreshOnAnalysisEventOptions = {},
) {
  const { lastAnalysisEvent } = useAnalysisStatus();
  // Depend on individual fields so inline options literals don't re-trigger
  // the effect every render.
  const { includeStarted, includeCompleted, includeFailed, taskId, taskIds, analysisMode } =
    options;
  const taskIdsKey = taskIds === undefined || taskIds === null ? "" : taskIds.join("|");
  const analysisModeKey = Array.isArray(analysisMode)
    ? analysisMode.join("|")
    : (analysisMode ?? "");

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const lastHandledReceivedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (
      !lastAnalysisEvent ||
      !shouldRefreshForEvent(lastAnalysisEvent, {
        includeStarted,
        includeCompleted,
        includeFailed,
        taskId,
        taskIds,
        analysisMode,
      })
    ) {
      return;
    }

    if (lastHandledReceivedAtRef.current === lastAnalysisEvent.receivedAt) {
      return;
    }
    lastHandledReceivedAtRef.current = lastAnalysisEvent.receivedAt;

    // Defense-in-depth: `onRefresh` is typed `() => void | Promise<void>`
    // but in practice is often async and may reject (e.g. the REST
    // analyze-batch endpoint surfacing `LLM_ERROR`). Wrap in
    // `Promise.resolve(...)` so both sync and async returns are handled,
    // and swallow the rejection locally — the refresh callbacks already
    // log errors internally, so there is nothing more to report here.
    // Without this guard the rejection would reach the global
    // `window.unhandledrejection` listener and be logged as
    // `未處理的非同步錯誤`.
    void Promise.resolve(onRefreshRef.current()).catch((e) => {
      logWarn("[useRefreshOnAnalysisEvent] onRefresh rejected", e);
    });
    // taskIds / analysisMode mirrored by *Key so inline literals don't retrigger every render
  }, [
    lastAnalysisEvent,
    analysisMode,
    analysisModeKey,
    includeCompleted,
    includeFailed,
    includeStarted,
    taskId,
    taskIds,
    taskIdsKey,
  ]);
}

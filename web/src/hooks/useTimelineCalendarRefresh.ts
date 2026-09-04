import { useEffect, useRef } from "react";

import { subscribeResourceModified } from "../domain/sse/resourceModified";
import { shouldTimelineRefreshForResource } from "../domain/timeline/timelineCalendarRefresh";
import { ANALYSIS_EVENTS_MODES } from "../domain/tasks/analysisModeCapabilities";
import type { AnalysisTask } from "../types";
import { logWarn } from "../utils/logger";
import { useRefreshOnAnalysisEvent } from "./useRefreshOnAnalysisEvent";

export const TIMELINE_RESOURCE_REFRESH_COALESCE_MS = 500;

interface UseTimelineCalendarRefreshOptions {
  /** Pause subscriptions while the board shell is visible (pages keep-mounted). */
  enabled: boolean;
  refreshEvents: (catalogOverride?: readonly AnalysisTask[]) => Promise<void>;
  /**
   * When a recurring/task row changes, refresh the catalog first so filter plans
   * include new RRULE tasks before the merged calendar fetch runs.
   */
  refreshTasks?: () => Promise<AnalysisTask[]>;
}

/**
 * Timeline calendar auto-refresh: analysis SSE + `resource_modified` bridge.
 *
 * Matches board timed-event widgets (no per-filter taskIds gate on analysis) —
 * `refreshEvents` already respects the active source filter plan.
 * `resource_modified` bursts are coalesced (~500ms) so analysis batches do not
 * stampede `/calendar/window`.
 */
export function useTimelineCalendarRefresh({
  enabled,
  refreshEvents,
  refreshTasks,
}: UseTimelineCalendarRefreshOptions): void {
  useRefreshOnAnalysisEvent(refreshEvents, {
    taskIds: enabled ? undefined : [],
    analysisMode: ANALYSIS_EVENTS_MODES,
  });

  const refreshEventsRef = useRef(refreshEvents);
  refreshEventsRef.current = refreshEvents;
  const refreshTasksRef = useRef(refreshTasks);
  refreshTasksRef.current = refreshTasks;

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let pendingNeedsTaskRefresh = false;

    const flush = () => {
      timer = null;
      const needsTask = pendingNeedsTaskRefresh;
      pendingNeedsTaskRefresh = false;
      void (async () => {
        try {
          if (needsTask && refreshTasksRef.current) {
            const catalog = await refreshTasksRef.current();
            await refreshEventsRef.current(catalog);
            return;
          }
          await refreshEventsRef.current();
        } catch (err) {
          logWarn("[timeline] refresh after resource_modified failed", err);
        }
      })();
    };

    const unsubscribe = subscribeResourceModified((detail) => {
      if (!shouldTimelineRefreshForResource(detail.resourceType)) {
        return;
      }
      if (detail.resourceType === "task") {
        pendingNeedsTaskRefresh = true;
      }
      if (timer != null) clearTimeout(timer);
      timer = setTimeout(flush, TIMELINE_RESOURCE_REFRESH_COALESCE_MS);
    });

    return () => {
      unsubscribe();
      if (timer != null) clearTimeout(timer);
    };
  }, [enabled]);
}

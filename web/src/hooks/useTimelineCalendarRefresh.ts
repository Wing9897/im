import { useEffect } from "react";

import { subscribeResourceModified } from "../domain/sse/resourceModified";
import { shouldTimelineRefreshForResource } from "../domain/timeline/timelineCalendarRefresh";
import { ANALYSIS_EVENTS_MODES } from "../domain/tasks/analysisModeCapabilities";
import type { AnalysisTask } from "../types";
import { logWarn } from "../utils/logger";
import { useRefreshOnAnalysisEvent } from "./useRefreshOnAnalysisEvent";

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

  useEffect(() => {
    if (!enabled) return;

    return subscribeResourceModified((detail) => {
      if (!shouldTimelineRefreshForResource(detail.resourceType)) {
        return;
      }

      void (async () => {
        try {
          if (detail.resourceType === "task" && refreshTasks) {
            const catalog = await refreshTasks();
            await refreshEvents(catalog);
            return;
          }
          await refreshEvents();
        } catch (err) {
          logWarn("[timeline] refresh after resource_modified failed", err);
        }
      })();
    });
  }, [enabled, refreshEvents, refreshTasks]);
}

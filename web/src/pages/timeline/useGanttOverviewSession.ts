import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  overviewFetchWindow,
  overviewWindowEndMs,
  overviewWindowFromScale,
  formatOverviewWindowLabel,
  panOverviewWindow,
  recenterOverviewWindow,
  type GanttOverviewWindow,
} from "../../domain/gantt/ganttOverviewWindow";
import type { TimelineScale } from "../../domain/timeline/dateUtils";

/**
 * 全局/Overview-mode viewport: seeded from the current discrete scale when entering,
 * then independently panned / zoomed.
 */
export function useGanttOverviewSession(options: {
  overviewMode: boolean;
  timeScale: TimelineScale;
  timeCursor: Date;
}) {
  const { overviewMode, timeScale, timeCursor } = options;
  const [overviewWindow, setOverviewWindow] = useState<GanttOverviewWindow>(() =>
    overviewWindowFromScale(timeScale, timeCursor),
  );
  const wasOverview = useRef(false);

  useEffect(() => {
    if (overviewMode && !wasOverview.current) {
      setOverviewWindow(overviewWindowFromScale(timeScale, timeCursor));
    }
    wasOverview.current = overviewMode;
  }, [overviewMode, timeScale, timeCursor]);

  const fetchRange = useMemo(() => overviewFetchWindow(overviewWindow), [overviewWindow]);
  const visibleStart = useMemo(
    () => new Date(overviewWindow.startMs),
    [overviewWindow.startMs],
  );
  const visibleEnd = useMemo(
    () => new Date(overviewWindowEndMs(overviewWindow)),
    [overviewWindow],
  );
  const visibleRangeLabel = useMemo(
    () => formatOverviewWindowLabel(overviewWindow),
    [overviewWindow],
  );

  const panByStep = useCallback((delta: number) => {
    setOverviewWindow((window) => panOverviewWindow(window, delta * window.spanMs * 0.8));
  }, []);

  const recenterToday = useCallback(() => {
    setOverviewWindow((window) => recenterOverviewWindow(window, Date.now()));
  }, []);

  return {
    overviewWindow,
    setOverviewWindow,
    fetchRange,
    visibleStart,
    visibleEnd,
    visibleRangeLabel,
    panByStep,
    recenterToday,
  };
}

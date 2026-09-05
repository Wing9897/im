import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  OVERVIEW_FETCH_DEBOUNCE_MS,
  OVERVIEW_RANGE_PRESETS,
  clampOverviewWindow,
  overviewFetchWindow,
  overviewWindowEndMs,
  overviewWindowFromScale,
  overviewWindowFromSpan,
  formatOverviewWindowLabel,
  panOverviewWindow,
  parseOverviewRangeId,
  recenterOverviewWindow,
  type GanttOverviewWindow,
  type OverviewRangePresetId,
} from "../../domain/gantt/ganttOverviewWindow";
import { TIMELINE_OVERVIEW_SPAN_STORAGE_KEY } from "../../domain/prefs";
import { usePersistedState } from "../../hooks/usePersistedState";
import type { TimelineScale } from "../../domain/timeline/dateUtils";

function windowsEqual(a: GanttOverviewWindow, b: GanttOverviewWindow): boolean {
  return a.startMs === b.startMs && a.spanMs === b.spanMs;
}

/**
 * 全局/Overview-mode viewport: seeded from the current discrete scale when entering,
 * then independently panned / zoomed.
 *
 * Visible window updates on every pointer/wheel tick. Fetch window commits on
 * pointerup or after {@link OVERVIEW_FETCH_DEBOUNCE_MS} idle — `useTimelineData`
 * must subscribe to `fetchRange` only.
 *
 * Range-menu / now / date jumps set visible + committed windows together so a
 * navigation click is one fetch, not a debounce burst.
 */
export function useGanttOverviewSession(options: {
  overviewMode: boolean;
  timeScale: TimelineScale;
  timeCursor: Date;
}) {
  const { overviewMode, timeScale, timeCursor } = options;
  const [overviewWindow, setOverviewWindowState] = useState<GanttOverviewWindow>(() =>
    overviewWindowFromScale(timeScale, timeCursor),
  );
  const [committedFetchWindow, setCommittedFetchWindow] = useState<GanttOverviewWindow>(
    overviewWindow,
  );
  const [persistedRangeId, setPersistedRangeId] = usePersistedState(
    TIMELINE_OVERVIEW_SPAN_STORAGE_KEY,
    "",
  );
  const wasOverview = useRef(false);
  const visibleRef = useRef(overviewWindow);
  visibleRef.current = overviewWindow;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyVisible = useCallback((next: GanttOverviewWindow): GanttOverviewWindow => {
    const clamped = clampOverviewWindow(next);
    visibleRef.current = clamped;
    return clamped;
  }, []);

  const commitFetchWindow = useCallback(() => {
    if (debounceRef.current != null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const next = clampOverviewWindow(visibleRef.current);
    setCommittedFetchWindow((prev) => (windowsEqual(prev, next) ? prev : next));
  }, []);

  const applyNavigatedWindow = useCallback(
    (next: GanttOverviewWindow) => {
      const clamped = applyVisible(next);
      setOverviewWindowState(clamped);
      commitFetchWindow();
    },
    [applyVisible, commitFetchWindow],
  );

  const scheduleFetchCommit = useCallback(() => {
    if (debounceRef.current != null) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      commitFetchWindow();
    }, OVERVIEW_FETCH_DEBOUNCE_MS);
  }, [commitFetchWindow]);

  useEffect(() => {
    return () => {
      if (debounceRef.current != null) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    if (overviewMode && !wasOverview.current) {
      const preset = parseOverviewRangeId(persistedRangeId);
      const seeded = preset
        ? overviewWindowFromSpan(OVERVIEW_RANGE_PRESETS[preset], Date.now())
        : overviewWindowFromScale(timeScale, timeCursor);
      setOverviewWindowState(seeded);
      visibleRef.current = seeded;
      setCommittedFetchWindow(seeded);
    }
    wasOverview.current = overviewMode;
  }, [overviewMode, persistedRangeId, timeScale, timeCursor]);

  const setOverviewWindow = useCallback(
    (next: GanttOverviewWindow | ((window: GanttOverviewWindow) => GanttOverviewWindow)) => {
      setOverviewWindowState((prev) => {
        const resolved = typeof next === "function" ? next(prev) : next;
        return applyVisible(resolved);
      });
      scheduleFetchCommit();
    },
    [applyVisible, scheduleFetchCommit],
  );

  const fetchRange = useMemo(
    () => overviewFetchWindow(committedFetchWindow),
    [committedFetchWindow],
  );
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

  const panByStep = useCallback(
    (delta: number) => {
      const current = visibleRef.current;
      applyNavigatedWindow(panOverviewWindow(current, delta * current.spanMs * 0.8));
    },
    [applyNavigatedWindow],
  );

  const recenterToday = useCallback(() => {
    applyNavigatedWindow(recenterOverviewWindow(visibleRef.current, Date.now()));
  }, [applyNavigatedWindow]);

  const jumpToTimestamp = useCallback(
    (centerMs: number) => {
      applyNavigatedWindow(recenterOverviewWindow(visibleRef.current, centerMs));
    },
    [applyNavigatedWindow],
  );

  const applyRangeId = useCallback(
    (id: OverviewRangePresetId | string) => {
      const preset = parseOverviewRangeId(id);
      if (!preset) return;
      setPersistedRangeId(preset);
      const current = visibleRef.current;
      const center = current.startMs + current.spanMs / 2;
      applyNavigatedWindow(overviewWindowFromSpan(OVERVIEW_RANGE_PRESETS[preset], center));
    },
    [applyNavigatedWindow, setPersistedRangeId],
  );

  return {
    overviewWindow,
    setOverviewWindow,
    commitFetchWindow,
    fetchRange,
    visibleStart,
    visibleEnd,
    visibleRangeLabel,
    panByStep,
    recenterToday,
    jumpToTimestamp,
    applyRangeId,
  };
}

import { useCallback, useEffect, useMemo } from "react";

import { startOfDay } from "../../domain/timeline/dateUtils";
import { usePersistedState } from "../../hooks/usePersistedState";
import { parsePersistedTimelineDay } from "./useTimelineNavigation";
import {
  TIMELINE_FOCUSED_DAY_STORAGE_KEY,
  TIMELINE_SELECTED_GANTT_TASK_ID_STORAGE_KEY,
  TIMELINE_SHOW_DISMISSED_STORAGE_KEY,
  TIMELINE_SHOW_ENDING_STORAGE_KEY,
  TIMELINE_SHOW_ONGOING_STORAGE_KEY,
  TIMELINE_VIEW_MODE_STORAGE_KEY,
} from "../../domain/prefs";

export type TimelineViewMode = "calendar" | "gantt";

const VALID_VIEW_MODES = ["calendar", "gantt"] as const;

/**
 * Device-local Timeline preferences (view mode, chip toggles, focused day,
 * selected gantt row). Split out of the page container so the persistence
 * rules stay readable next to each other.
 *
 * `focusedDay` never resolves to null: a cleared / legacy value falls back to
 * today so the sidebar stays day-scoped.
 */
export function useTimelinePagePrefs() {
  const [rawViewMode, setViewMode] = usePersistedState<TimelineViewMode>(
    TIMELINE_VIEW_MODE_STORAGE_KEY,
    "calendar",
  );
  const viewMode: TimelineViewMode =
    (VALID_VIEW_MODES as readonly string[]).includes(rawViewMode) ? rawViewMode : "calendar";
  useEffect(() => { if (rawViewMode !== viewMode) setViewMode("calendar"); }, [rawViewMode, viewMode, setViewMode]);

  const [showDismissed, setShowDismissed] = usePersistedState(
    TIMELINE_SHOW_DISMISSED_STORAGE_KEY,
    true,
  );
  const [showOngoing, setShowOngoing] = usePersistedState(
    TIMELINE_SHOW_ONGOING_STORAGE_KEY,
    true,
  );
  const [showEnding, setShowEnding] = usePersistedState(
    TIMELINE_SHOW_ENDING_STORAGE_KEY,
    true,
  );

  const [focusedDayIso, setFocusedDayIso] = usePersistedState<string | null>(
    TIMELINE_FOCUSED_DAY_STORAGE_KEY,
    startOfDay(new Date()).toISOString(),
  );
  const focusedDay = useMemo(() => {
    if (focusedDayIso === null || focusedDayIso === "") {
      return startOfDay(new Date());
    }
    return parsePersistedTimelineDay(focusedDayIso) ?? startOfDay(new Date());
  }, [focusedDayIso]);
  const setFocusedDay = useCallback((day: Date | null) => {
    // null means "reset to today" (sidebar never shows the full view range).
    setFocusedDayIso(startOfDay(day ?? new Date()).toISOString());
  }, [setFocusedDayIso]);

  const [selectedGanttTaskId, setSelectedGanttTaskId] = usePersistedState<string | null>(
    TIMELINE_SELECTED_GANTT_TASK_ID_STORAGE_KEY,
    null,
  );

  return {
    viewMode,
    setViewMode,
    showDismissed,
    setShowDismissed,
    showOngoing,
    setShowOngoing,
    showEnding,
    setShowEnding,
    focusedDay,
    setFocusedDay,
    selectedGanttTaskId,
    setSelectedGanttTaskId,
  };
}

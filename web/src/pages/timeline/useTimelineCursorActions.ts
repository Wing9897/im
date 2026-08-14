import { useCallback } from "react";

import {
  addDays,
  addMonths,
  addQuarters,
  addYears,
  startOfDay,
  type TimelineScale,
} from "../../domain/timeline/dateUtils";
import type { UseTimelineNavigationReturn } from "./useTimelineNavigation";
import type { TimelineViewMode } from "./useTimelinePagePrefs";

type Options = {
  navigation: UseTimelineNavigationReturn;
  setViewMode: (mode: TimelineViewMode) => void;
  setFocusedDay: (day: Date | null) => void;
  clearSelectedEvent: () => void;
};

/**
 * Cursor / view-mode actions that have to keep the navigation cursor and the
 * day-scoped sidebar in step. Kept out of `useTimelineNavigation` because they
 * also touch preferences and selection, which that hook does not own.
 */
export function useTimelineCursorActions({
  navigation,
  setViewMode,
  setFocusedDay,
  clearSelectedEvent,
}: Options) {
  const handleSetViewMode = useCallback((mode: TimelineViewMode) => {
    setViewMode(mode);
    if (mode === "calendar" && (navigation.timeScale === "quarter" || navigation.timeScale === "year")) {
      navigation.setTimeScale("month");
    }
  }, [setViewMode, navigation]);

  const focusDay = useCallback((day: Date) => {
    clearSelectedEvent();
    if (navigation.timeScale === "day") navigation.setTimeCursor(startOfDay(day));
    setFocusedDay(startOfDay(day));
  }, [navigation, clearSelectedEvent, setFocusedDay]);

  /** Jump calendar cursor + focused day (deep-links from workset summary). */
  const goToDay = useCallback(
    (day: Date) => {
      const normalized = startOfDay(day);
      navigation.setTimeCursor(normalized);
      setFocusedDay(normalized);
    },
    [navigation, setFocusedDay],
  );

  const handleJumpTo = useCallback(
    (scale: TimelineScale) => {
      // Jump snaps the cursor to today — keep the sidebar on today too.
      setFocusedDay(startOfDay(new Date()));
      navigation.jumpTo(scale);
    },
    [navigation, setFocusedDay],
  );

  const handleMoveCursor = useCallback(
    (delta: number) => {
      const scale = navigation.timeScale;
      const cursor = navigation.timeCursor;
      let nextFocus = cursor;
      if (scale === "day") nextFocus = addDays(cursor, delta);
      else if (scale === "week") nextFocus = addDays(cursor, delta * 7);
      else if (scale === "quarter") nextFocus = addQuarters(cursor, delta);
      else if (scale === "year") nextFocus = addYears(cursor, delta);
      else nextFocus = addMonths(cursor, delta);
      navigation.moveCursor(delta);
      // Sidebar stays day-scoped: follow the navigated cursor day.
      setFocusedDay(startOfDay(nextFocus));
    },
    [navigation, setFocusedDay],
  );

  return { handleSetViewMode, focusDay, goToDay, handleJumpTo, handleMoveCursor };
}

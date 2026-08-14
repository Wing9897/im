import { useCallback, useMemo } from "react";

import { usePersistedState } from "../../hooks/usePersistedState";
import {
  addDays,
  addMonths,
  addQuarters,
  addYears,
  buildCalendarDays,
  buildWeekDays,
  formatRangeLabel,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  type GanttColumn,
  type TimelineScale,
} from "../../domain/timeline/dateUtils";
import { buildGanttColumns } from "./timelineGanttColumns";
import {
  TIMELINE_TIME_CURSOR_STORAGE_KEY,
  TIMELINE_TIME_SCALE_STORAGE_KEY,
} from "../../domain/prefs";

export {
  TIMELINE_TIME_CURSOR_STORAGE_KEY,
  TIMELINE_TIME_SCALE_STORAGE_KEY,
} from "../../domain/prefs";

/** Parse persisted ISO day; invalid values return null. */
export function parsePersistedTimelineDay(iso: string): Date | null {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return startOfDay(parsed);
}

function defaultTimeCursorIso(): string {
  return startOfDay(new Date()).toISOString();
}

/** Returns the anchor date when jumping to a scale (today within period, not period start for month). */
function getScaleStart(scale: TimelineScale, date: Date): Date {
  if (scale === "day") return startOfDay(date);
  if (scale === "week") return startOfWeek(date);
  if (scale === "quarter") return startOfQuarter(date);
  if (scale === "year") return startOfYear(date);
  // Month view shows a calendar grid; keep today's date, not the 1st.
  return startOfDay(date);
}

export interface UseTimelineNavigationReturn {
  /** Current time scale (day / week / month / quarter / year). */
  timeScale: TimelineScale;
  /** Update the time scale. */
  setTimeScale: (scale: TimelineScale) => void;
  /** The cursor date representing the user's current position in time. */
  timeCursor: Date;
  /** Set the cursor to a specific date. */
  setTimeCursor: (date: Date | ((prev: Date) => Date)) => void;
  /** Start of the visible date range based on scale + cursor. */
  rangeStart: Date;
  /** End of the visible date range based on scale + cursor. */
  rangeEnd: Date;
  /** First day of the month the cursor is within. */
  monthCursor: Date;
  /** 42-day grid for calendar month rendering. */
  monthDays: Date[];
  /** 7 days of the week the cursor is within. */
  weekDays: Date[];
  /** Gantt columns derived from scale + cursor. */
  ganttColumns: GanttColumn[];
  /** Human-readable label for the current visible range. */
  visibleRangeLabel: string;
  /** Navigate forward/backward by one period. */
  moveCursor: (delta: number) => void;
  /** Jump to today at the given scale. */
  jumpTo: (nextScale: TimelineScale) => void;
}

/**
 * Encapsulates timeline navigation state and handlers:
 * - Time scale (day/week/month/quarter/year)
 * - Time cursor and date range computation
 * - Next/prev period navigation
 * - Scale change (jump to today at new scale)
 * - Calendar grid and Gantt column derivation
 */
export function useTimelineNavigation(): UseTimelineNavigationReturn {
  const [timeScale, setTimeScale] = usePersistedState<TimelineScale>(
    TIMELINE_TIME_SCALE_STORAGE_KEY,
    "month",
  );

  const [timeCursorIso, setTimeCursorIso] = usePersistedState<string>(
    TIMELINE_TIME_CURSOR_STORAGE_KEY,
    defaultTimeCursorIso(),
  );

  const timeCursor = useMemo(() => {
    return parsePersistedTimelineDay(timeCursorIso) ?? startOfDay(new Date());
  }, [timeCursorIso]);

  const setTimeCursor = useCallback(
    (date: Date | ((prev: Date) => Date)) => {
      setTimeCursorIso((prevIso) => {
        const prevDate =
          parsePersistedTimelineDay(prevIso) ?? startOfDay(new Date());
        const next = typeof date === "function" ? date(prevDate) : date;
        return startOfDay(next).toISOString();
      });
    },
    [setTimeCursorIso],
  );

  // ─── Derived Date Ranges ───────────────────────────────────────────────────

  const rangeStart = useMemo(() => {
    if (timeScale === "day") return startOfDay(timeCursor);
    if (timeScale === "week") return startOfWeek(timeCursor);
    if (timeScale === "quarter") return startOfQuarter(timeCursor);
    if (timeScale === "year") return startOfYear(timeCursor);
    return startOfMonth(timeCursor);
  }, [timeCursor, timeScale]);

  const rangeEnd = useMemo(() => {
    if (timeScale === "day") return addDays(rangeStart, 1);
    if (timeScale === "week") return addDays(rangeStart, 7);
    if (timeScale === "quarter") return addQuarters(rangeStart, 1);
    if (timeScale === "year") return addYears(rangeStart, 1);
    return addMonths(rangeStart, 1);
  }, [rangeStart, timeScale]);

  // ─── Calendar Grids ────────────────────────────────────────────────────────

  const monthCursor = useMemo(() => startOfMonth(timeCursor), [timeCursor]);
  const monthDays = useMemo(() => buildCalendarDays(monthCursor), [monthCursor]);
  const weekDays = useMemo(() => buildWeekDays(timeCursor), [timeCursor]);

  // ─── Gantt Columns ─────────────────────────────────────────────────────────

  const ganttColumns = useMemo(
    () => buildGanttColumns(timeScale, timeCursor, monthCursor, weekDays),
    [monthCursor, timeCursor, timeScale, weekDays],
  );

  // ─── Navigation Handlers ───────────────────────────────────────────────────

  const moveCursor = useCallback(
    (delta: number) => {
      setTimeCursor((current) => {
        if (timeScale === "day") return addDays(current, delta);
        if (timeScale === "week") return addDays(current, delta * 7);
        if (timeScale === "quarter") return addQuarters(current, delta);
        if (timeScale === "year") return addYears(current, delta);
        return addMonths(current, delta);
      });
    },
    [setTimeCursor, timeScale],
  );

  const jumpTo = useCallback(
    (nextScale: TimelineScale) => {
      const now = new Date();
      setTimeScale(nextScale);
      setTimeCursor(getScaleStart(nextScale, now));
    },
    [setTimeCursor, setTimeScale],
  );

  const visibleRangeLabel = formatRangeLabel(timeScale, timeCursor);

  // ─── Return ────────────────────────────────────────────────────────────────

  return {
    timeScale,
    setTimeScale,
    timeCursor,
    setTimeCursor,
    rangeStart,
    rangeEnd,
    monthCursor,
    monthDays,
    weekDays,
    ganttColumns,
    visibleRangeLabel,
    moveCursor,
    jumpTo,
  };
}

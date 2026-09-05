import {
  addMonths,
  addQuarters,
  addYears,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  type TimelineScale,
} from "../timeline/dateUtils";
import { GANTT_DAY_MS } from "./ganttTimeGeometry";
import {
  OVERVIEW_MAX_SPAN_MS,
  OVERVIEW_MIN_SPAN_MS,
  OVERVIEW_RANGE_PRESET_IDS,
  OVERVIEW_RANGE_PRESETS,
  type GanttOverviewWindow,
  type OverviewRangePresetId,
} from "./overviewConstants";

export function overviewWindowEndMs(window: GanttOverviewWindow): number {
  return window.startMs + window.spanMs;
}

/** Last included instant of a half-open `[start, end)` window. */
export function overviewInclusiveEndMs(window: GanttOverviewWindow): number {
  return overviewWindowEndMs(window) - 1;
}

export function clampOverviewSpan(spanMs: number): number {
  if (!Number.isFinite(spanMs) || spanMs <= 0) return OVERVIEW_MIN_SPAN_MS;
  return Math.min(OVERVIEW_MAX_SPAN_MS, Math.max(OVERVIEW_MIN_SPAN_MS, spanMs));
}

export function clampOverviewWindow(window: GanttOverviewWindow): GanttOverviewWindow {
  const spanMs = clampOverviewSpan(window.spanMs);
  const startMs = Number.isFinite(window.startMs) ? window.startMs : Date.now() - spanMs / 2;
  return { startMs, spanMs };
}

export function panOverviewWindow(window: GanttOverviewWindow, deltaMs: number): GanttOverviewWindow {
  const shift = Number.isFinite(deltaMs) ? deltaMs : 0;
  return clampOverviewWindow({ startMs: window.startMs + shift, spanMs: window.spanMs });
}

/** Zoom around a focal ratio in [0, 1] (0 = left edge, 1 = right). */
export function zoomOverviewWindow(
  window: GanttOverviewWindow,
  factor: number,
  focalRatio = 0.5,
): GanttOverviewWindow {
  const ratio = Number.isFinite(focalRatio) ? Math.min(1, Math.max(0, focalRatio)) : 0.5;
  const safeFactor = Number.isFinite(factor) && factor > 0 ? factor : 1;
  const nextSpan = clampOverviewSpan(window.spanMs * safeFactor);
  const focalMs = window.startMs + ratio * window.spanMs;
  return clampOverviewWindow({
    startMs: focalMs - ratio * nextSpan,
    spanMs: nextSpan,
  });
}

export function zoomOverviewWindowAtPx(
  window: GanttOverviewWindow,
  trackWidthPx: number,
  cursorX: number,
  factor: number,
): GanttOverviewWindow {
  const ratio = trackWidthPx > 0 ? cursorX / trackWidthPx : 0.5;
  return zoomOverviewWindow(window, factor, ratio);
}

/** Drag-the-track pan: content follows the pointer. */
export function panDeltaMsFromPointer(
  deltaPx: number,
  trackWidthPx: number,
  spanMs: number,
): number {
  if (!(trackWidthPx > 0) || !(spanMs > 0) || !Number.isFinite(deltaPx)) return 0;
  return -(deltaPx / trackWidthPx) * spanMs;
}

export function overviewWindowFromScale(scale: TimelineScale, cursor: Date): GanttOverviewWindow {
  if (scale === "day") {
    const start = startOfDay(cursor);
    return clampOverviewWindow({ startMs: start.getTime(), spanMs: GANTT_DAY_MS });
  }
  if (scale === "week") {
    const start = startOfWeek(cursor);
    return clampOverviewWindow({ startMs: start.getTime(), spanMs: 7 * GANTT_DAY_MS });
  }
  if (scale === "month") {
    const start = startOfMonth(cursor);
    const end = addMonths(start, 1);
    return clampOverviewWindow({
      startMs: start.getTime(),
      spanMs: end.getTime() - start.getTime(),
    });
  }
  if (scale === "quarter") {
    const start = startOfQuarter(cursor);
    const end = addQuarters(start, 1);
    return clampOverviewWindow({
      startMs: start.getTime(),
      spanMs: end.getTime() - start.getTime(),
    });
  }
  const start = startOfYear(cursor);
  const end = addYears(start, 1);
  return clampOverviewWindow({
    startMs: start.getTime(),
    spanMs: end.getTime() - start.getTime(),
  });
}

export function recenterOverviewWindow(
  window: GanttOverviewWindow,
  centerMs: number,
): GanttOverviewWindow {
  const center = Number.isFinite(centerMs) ? centerMs : Date.now();
  return clampOverviewWindow({
    startMs: center - window.spanMs / 2,
    spanMs: window.spanMs,
  });
}

const RANGE_MATCH_TOLERANCE = 0.08;

export function parseOverviewRangeId(
  value: string | null | undefined,
): OverviewRangePresetId | null {
  if (!value) return null;
  return (OVERVIEW_RANGE_PRESET_IDS as readonly string[]).includes(value)
    ? (value as OverviewRangePresetId)
    : null;
}

/** Nearest preset id when the visible span is within 8% of a listed range. */
export function matchOverviewRangeId(spanMs: number): OverviewRangePresetId | null {
  if (!Number.isFinite(spanMs) || spanMs <= 0) return null;
  for (const id of OVERVIEW_RANGE_PRESET_IDS) {
    const preset = OVERVIEW_RANGE_PRESETS[id];
    if (Math.abs(spanMs - preset) / preset <= RANGE_MATCH_TOLERANCE) return id;
  }
  return null;
}

/** Span around a center instant (range-menu / persist restore). */
export function overviewWindowFromSpan(spanMs: number, centerMs: number): GanttOverviewWindow {
  return recenterOverviewWindow({ startMs: 0, spanMs }, centerMs);
}

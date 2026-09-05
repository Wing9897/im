import { GANTT_DAY_MS, GANTT_HOUR_MS } from "./ganttTimeGeometry";

export const OVERVIEW_MIN_SPAN_MS = 2 * GANTT_HOUR_MS;
export const OVERVIEW_MAX_SPAN_MS = Math.round(10 * 365.25 * GANTT_DAY_MS);
export const OVERVIEW_ZOOM_FACTOR = 1.2;
/** Hard cap for GET /calendar/window in 全局/Overview — never approach OVERVIEW_MAX_SPAN_MS. */
export const OVERVIEW_FETCH_MAX_MS = 90 * GANTT_DAY_MS;
export const OVERVIEW_FETCH_BUCKET_SHORT_MS = 14 * GANTT_DAY_MS;
export const OVERVIEW_FETCH_BUCKET_LONG_MS = 30 * GANTT_DAY_MS;
/** Pan/zoom commits the fetch window after this idle period (pointerup commits immediately). */
export const OVERVIEW_FETCH_DEBOUNCE_MS = 250;
/** Drop a tick label when it would sit closer than this fraction of the track. */
export const OVERVIEW_MIN_TICK_LABEL_PCT = 6;
/** Floor used when the track width is known — long labels like "2031 Q1" need ~56px. */
export const OVERVIEW_MIN_TICK_LABEL_PX = 56;

export type GanttOverviewWindow = {
  startMs: number;
  spanMs: number;
};

export type OverviewTick = {
  ms: number;
  label: string;
  major: boolean;
};

export type OverviewBarLayout = {
  leftPct: number;
  widthPct: number;
  isPoint: boolean;
};

/**
 * Duration bars narrower than this (percent of the visible window) read as
 * ticks on a zoomed-out 全局 canvas — same compact treatment as true points.
 */
export const OVERVIEW_COMPACT_WIDTH_PCT = 1.25;

export function padOverview2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Quick-jump spans for 全局/Overview (calendar, not LIVE ±hours). */
export const OVERVIEW_RANGE_PRESET_IDS = ["12h", "1d", "7d", "30d", "90d", "1y"] as const;
export type OverviewRangePresetId = (typeof OVERVIEW_RANGE_PRESET_IDS)[number];

export const OVERVIEW_RANGE_PRESETS: Record<OverviewRangePresetId, number> = {
  "12h": 12 * GANTT_HOUR_MS,
  "1d": GANTT_DAY_MS,
  "7d": 7 * GANTT_DAY_MS,
  "30d": 30 * GANTT_DAY_MS,
  "90d": 90 * GANTT_DAY_MS,
  "1y": 365 * GANTT_DAY_MS,
};

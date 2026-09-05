/**
 * Continuous 全局/Overview-mode window: pan / zoom across hours ↔ years.
 * Discrete 日/週/月/季/年 pills stay complete views; this math is overview-only.
 */
export {
  OVERVIEW_COMPACT_WIDTH_PCT,
  OVERVIEW_FETCH_BUCKET_LONG_MS,
  OVERVIEW_FETCH_BUCKET_SHORT_MS,
  OVERVIEW_FETCH_DEBOUNCE_MS,
  OVERVIEW_FETCH_MAX_MS,
  OVERVIEW_MAX_SPAN_MS,
  OVERVIEW_MIN_SPAN_MS,
  OVERVIEW_MIN_TICK_LABEL_PCT,
  OVERVIEW_MIN_TICK_LABEL_PX,
  OVERVIEW_RANGE_PRESET_IDS,
  OVERVIEW_RANGE_PRESETS,
  OVERVIEW_ZOOM_FACTOR,
  type GanttOverviewWindow,
  type OverviewBarLayout,
  type OverviewRangePresetId,
  type OverviewTick,
} from "./overviewConstants";
export {
  clampOverviewSpan,
  clampOverviewWindow,
  matchOverviewRangeId,
  overviewInclusiveEndMs,
  overviewWindowEndMs,
  overviewWindowFromScale,
  overviewWindowFromSpan,
  panDeltaMsFromPointer,
  panOverviewWindow,
  parseOverviewRangeId,
  recenterOverviewWindow,
  zoomOverviewWindow,
  zoomOverviewWindowAtPx,
} from "./overviewWindowOps";
export {
  formatOverviewWindowLabel,
  minOverviewTickLabelPct,
  overviewBarIsCompact,
  overviewBarLayout,
  overviewTickLabelPct,
  overviewTickLeftPct,
  thinOverviewTicks,
  ticksForOverviewWindow,
} from "./overviewTicks";
export { overviewFetchSpanMs, overviewFetchWindow } from "./overviewFetch";

/**
 * Continuous 全局/Overview-mode window: pan / zoom across hours ↔ years.
 * Discrete 日/週/月/季/年 pills stay complete views; this math is overview-only.
 */

import {
  addDays,
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
import { clipIntervalToAxis, GANTT_DAY_MS, GANTT_HOUR_MS } from "./ganttTimeGeometry";

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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

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

function hourTicks(
  startMs: number,
  endMs: number,
  stepHours: number,
  maxTicks: number,
): OverviewTick[] {
  const step = stepHours * GANTT_HOUR_MS;
  const startDate = new Date(startMs);
  startDate.setMinutes(0, 0, 0);
  const hour = startDate.getHours();
  const alignedHour = Math.ceil(hour / stepHours) * stepHours;
  startDate.setHours(alignedHour);
  let t = startDate.getTime();
  if (t < startMs) t += step;
  const ticks: OverviewTick[] = [];
  while (t < endMs && ticks.length < maxTicks + 2) {
    const d = new Date(t);
    ticks.push({
      ms: t,
      label: `${pad2(d.getHours())}:00`,
      major: d.getHours() === 0,
    });
    t += step;
  }
  return ticks;
}

function dayTicks(startMs: number, endMs: number, maxTicks: number): OverviewTick[] {
  let cursor = startOfDay(new Date(startMs));
  if (cursor.getTime() < startMs) cursor = addDays(cursor, 1);
  const ticks: OverviewTick[] = [];
  while (cursor.getTime() < endMs && ticks.length < maxTicks + 2) {
    ticks.push({
      ms: cursor.getTime(),
      label: `${cursor.getMonth() + 1}/${cursor.getDate()}`,
      major: cursor.getDate() === 1,
    });
    cursor = addDays(cursor, 1);
  }
  return ticks;
}

function weekTicks(startMs: number, endMs: number, maxTicks: number): OverviewTick[] {
  let cursor = startOfWeek(new Date(startMs));
  if (cursor.getTime() < startMs) cursor = addDays(cursor, 7);
  const ticks: OverviewTick[] = [];
  while (cursor.getTime() < endMs && ticks.length < maxTicks + 2) {
    ticks.push({
      ms: cursor.getTime(),
      label: `${cursor.getMonth() + 1}/${cursor.getDate()}`,
      major: cursor.getDate() <= 7,
    });
    cursor = addDays(cursor, 7);
  }
  return ticks;
}

function monthTicks(
  startMs: number,
  endMs: number,
  stepMonths: number,
  maxTicks: number,
): OverviewTick[] {
  const start = new Date(startMs);
  let cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  if (cursor.getTime() < startMs) {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + stepMonths, 1);
  }
  const ticks: OverviewTick[] = [];
  while (cursor.getTime() < endMs && ticks.length < maxTicks + 2) {
    const month = cursor.getMonth();
    ticks.push({
      ms: cursor.getTime(),
      label:
        stepMonths >= 3
          ? `${cursor.getFullYear()} Q${Math.floor(month / 3) + 1}`
          : `${cursor.getFullYear()}-${pad2(month + 1)}`,
      major: month === 0 || (stepMonths >= 3 && month % 3 === 0),
    });
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + stepMonths, 1);
  }
  return ticks;
}

function yearTicks(startMs: number, endMs: number, maxTicks: number): OverviewTick[] {
  const start = new Date(startMs);
  let year = start.getFullYear();
  let cursor = new Date(year, 0, 1);
  if (cursor.getTime() < startMs) {
    year += 1;
    cursor = new Date(year, 0, 1);
  }
  const ticks: OverviewTick[] = [];
  while (cursor.getTime() < endMs && ticks.length < maxTicks + 2) {
    ticks.push({
      ms: cursor.getTime(),
      label: String(cursor.getFullYear()),
      major: true,
    });
    cursor = new Date(cursor.getFullYear() + 1, 0, 1);
  }
  return ticks;
}

/** Minimum label spacing as a percent of the track, given an optional pixel width. */
export function minOverviewTickLabelPct(trackWidthPx: number): number {
  if (!(trackWidthPx > 0)) return OVERVIEW_MIN_TICK_LABEL_PCT;
  return Math.max(
    OVERVIEW_MIN_TICK_LABEL_PCT,
    (OVERVIEW_MIN_TICK_LABEL_PX / trackWidthPx) * 100,
  );
}

/**
 * Drop labels that would overlap. Prefers a nearby major tick over a minor one.
 * Positions use the same cell-midpoint / on-hour rules as the axis renderer.
 */
export function thinOverviewTicks(
  ticks: OverviewTick[],
  window: GanttOverviewWindow,
  minLabelPct = OVERVIEW_MIN_TICK_LABEL_PCT,
): OverviewTick[] {
  if (ticks.length <= 1 || !(minLabelPct > 0) || !(window.spanMs > 0)) return ticks;
  const kept: OverviewTick[] = [];
  let lastPct = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < ticks.length; i++) {
    const tick = ticks[i];
    const pct = overviewTickLabelPct(tick, ticks[i + 1]?.ms ?? null, window);
    if (kept.length > 0 && pct - lastPct < minLabelPct) {
      const last = kept[kept.length - 1];
      if (last !== undefined && tick.major && !last.major) {
        kept[kept.length - 1] = tick;
        lastPct = pct;
      }
      continue;
    }
    kept.push(tick);
    lastPct = pct;
  }
  return kept;
}

/**
 * Time-axis ticks that coarsen from hours → days → weeks → months → quarters → years.
 * Hour labels only appear on hour-scale windows; a ~year span is month/quarter (never hours).
 * Labels closer than `minLabelPct` of the track are skipped so they cannot overlap.
 */
export function ticksForOverviewWindow(
  window: GanttOverviewWindow,
  maxTicks = 12,
  minLabelPct = OVERVIEW_MIN_TICK_LABEL_PCT,
): OverviewTick[] {
  const span = Math.max(1, window.spanMs);
  const start = window.startMs;
  const end = start + span;
  const cap = Math.max(4, maxTicks);

  let ticks: OverviewTick[];
  if (span <= 12 * GANTT_HOUR_MS) ticks = hourTicks(start, end, 1, cap);
  else if (span <= 36 * GANTT_HOUR_MS) ticks = hourTicks(start, end, 3, cap);
  else if (span <= 2 * GANTT_DAY_MS) ticks = hourTicks(start, end, 6, cap);
  else if (span <= 16 * GANTT_DAY_MS) ticks = dayTicks(start, end, cap);
  else if (span <= 70 * GANTT_DAY_MS) ticks = weekTicks(start, end, cap);
  else if (span <= 240 * GANTT_DAY_MS) ticks = monthTicks(start, end, 1, cap);
  else if (span <= 4 * 365 * GANTT_DAY_MS) ticks = monthTicks(start, end, 3, cap);
  else ticks = yearTicks(start, end, cap);

  return thinOverviewTicks(ticks, window, minLabelPct);
}

export function formatOverviewWindowLabel(window: GanttOverviewWindow): string {
  const start = new Date(window.startMs);
  const inclusiveEnd = new Date(overviewInclusiveEndMs(window));
  const span = window.spanMs;
  if (span <= 2 * GANTT_DAY_MS) {
    return `${start.getMonth() + 1}/${start.getDate()} ${pad2(start.getHours())}:${pad2(start.getMinutes())} – ${inclusiveEnd.getMonth() + 1}/${inclusiveEnd.getDate()} ${pad2(inclusiveEnd.getHours())}:${pad2(inclusiveEnd.getMinutes())}`;
  }
  const firstTickDay =
    startOfDay(start).getTime() < window.startMs ? addDays(startOfDay(start), 1) : startOfDay(start);
  const lastDay = startOfDay(inclusiveEnd);
  const labelStart =
    firstTickDay.getTime() <= lastDay.getTime() ? firstTickDay : start;
  if (span <= 70 * GANTT_DAY_MS) {
    return `${labelStart.getMonth() + 1}/${labelStart.getDate()} – ${lastDay.getMonth() + 1}/${lastDay.getDate()}`;
  }
  if (span <= 400 * GANTT_DAY_MS) {
    return `${labelStart.getFullYear()}-${pad2(labelStart.getMonth() + 1)} – ${lastDay.getFullYear()}-${pad2(lastDay.getMonth() + 1)}`;
  }
  return `${labelStart.getFullYear()} – ${lastDay.getFullYear()}`;
}

export function overviewBarLayout(
  startMs: number,
  endMs: number | null,
  window: GanttOverviewWindow,
): OverviewBarLayout | null {
  const axisStart = window.startMs;
  const axisEnd = overviewWindowEndMs(window);
  if (!(window.spanMs > 0) || !Number.isFinite(startMs)) return null;
  const isPoint = endMs == null || !Number.isFinite(endMs) || endMs <= startMs;
  const rawEnd = isPoint ? startMs + 1 : endMs;
  const clipped = clipIntervalToAxis(startMs, rawEnd, axisStart, axisEnd);
  if (!clipped) return null;
  const leftPct = ((clipped.clippedStart - axisStart) / window.spanMs) * 100;
  const widthPct = Math.max(
    0.35,
    ((clipped.clippedEnd - clipped.clippedStart) / window.spanMs) * 100,
  );
  return { leftPct, widthPct, isPoint };
}

export function overviewBarIsCompact(layout: OverviewBarLayout): boolean {
  return layout.isPoint || layout.widthPct <= OVERVIEW_COMPACT_WIDTH_PCT;
}

export function overviewTickLeftPct(tickMs: number, window: GanttOverviewWindow): number {
  if (!(window.spanMs > 0)) return 0;
  return ((tickMs - window.startMs) / window.spanMs) * 100;
}

/**
 * Hour marks stay on the hour. Day/week/month/year labels sit in the middle
 * of [tick, nextTick|windowEnd) so they line up with the cell, not the
 * midnight grid line.
 */
export function overviewTickLabelPct(
  tick: OverviewTick,
  nextTickMs: number | null,
  window: GanttOverviewWindow,
): number {
  if (tick.label.includes(":")) return overviewTickLeftPct(tick.ms, window);
  const endMs = nextTickMs ?? overviewWindowEndMs(window);
  const mid = tick.ms + Math.max(0, endMs - tick.ms) / 2;
  return overviewTickLeftPct(mid, window);
}

/**
 * Bucketed, capped fetch range for 全局/Overview.
 * Span is `min(visibleSpan * 2, 90 days)` so pans inside a 14/30-day bucket
 * keep the same ISO bounds. Discrete day/week/month views keep ±7d padding
 * separately; Overview must not stack that pad on top of this window.
 */
export function overviewFetchSpanMs(visibleSpanMs: number): number {
  const span = Number.isFinite(visibleSpanMs) ? Math.max(visibleSpanMs, OVERVIEW_MIN_SPAN_MS) : OVERVIEW_MIN_SPAN_MS;
  return Math.min(Math.max(span * 2, 2 * GANTT_DAY_MS), OVERVIEW_FETCH_MAX_MS);
}

function snapDown(ms: number, bucketMs: number): number {
  return Math.floor(ms / bucketMs) * bucketMs;
}

function snapUp(ms: number, bucketMs: number): number {
  return Math.ceil(ms / bucketMs) * bucketMs;
}

export function overviewFetchWindow(window: GanttOverviewWindow): { start: Date; end: Date } {
  const w = clampOverviewWindow(window);
  const visibleStart = w.startMs;
  const visibleEnd = overviewWindowEndMs(w);
  const center = visibleStart + w.spanMs / 2;
  const fetchSpanMs = overviewFetchSpanMs(w.spanMs);
  const bucketMs =
    w.spanMs <= 40 * GANTT_DAY_MS
      ? OVERVIEW_FETCH_BUCKET_SHORT_MS
      : OVERVIEW_FETCH_BUCKET_LONG_MS;

  let rawStart = center - fetchSpanMs / 2;
  let rawEnd = center + fetchSpanMs / 2;
  if (w.spanMs <= OVERVIEW_FETCH_MAX_MS) {
    rawStart = Math.min(rawStart, visibleStart);
    rawEnd = Math.max(rawEnd, visibleEnd);
  }

  let startMs = snapDown(rawStart, bucketMs);
  let endMs = snapUp(rawEnd, bucketMs);
  if (endMs - startMs > OVERVIEW_FETCH_MAX_MS) {
    startMs = snapDown(center - OVERVIEW_FETCH_MAX_MS / 2, bucketMs);
    endMs = startMs + OVERVIEW_FETCH_MAX_MS;
  }

  const start = startOfDay(new Date(startMs));
  let end = startOfDay(new Date(endMs));
  if (end.getTime() < endMs) end = addDays(end, 1);
  if (end.getTime() <= start.getTime()) end = addDays(start, 1);
  if (end.getTime() - start.getTime() > OVERVIEW_FETCH_MAX_MS) {
    end = new Date(start.getTime() + OVERVIEW_FETCH_MAX_MS);
  }
  return { start, end };
}

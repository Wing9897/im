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

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function overviewWindowEndMs(window: GanttOverviewWindow): number {
  return window.startMs + window.spanMs;
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
  while (t <= endMs && ticks.length < maxTicks + 2) {
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
  while (cursor.getTime() <= endMs && ticks.length < maxTicks + 2) {
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
  while (cursor.getTime() <= endMs && ticks.length < maxTicks + 2) {
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
  while (cursor.getTime() <= endMs && ticks.length < maxTicks + 2) {
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
  while (cursor.getTime() <= endMs && ticks.length < maxTicks + 2) {
    ticks.push({
      ms: cursor.getTime(),
      label: String(cursor.getFullYear()),
      major: true,
    });
    cursor = new Date(cursor.getFullYear() + 1, 0, 1);
  }
  return ticks;
}

/** Time-axis ticks that coarsen from hours → days → weeks → months → quarters → years. */
export function ticksForOverviewWindow(
  window: GanttOverviewWindow,
  maxTicks = 12,
): OverviewTick[] {
  const span = Math.max(1, window.spanMs);
  const start = window.startMs;
  const end = start + span;
  const cap = Math.max(4, maxTicks);

  if (span <= 12 * GANTT_HOUR_MS) return hourTicks(start, end, 1, cap);
  if (span <= 36 * GANTT_HOUR_MS) return hourTicks(start, end, 3, cap);
  if (span <= 4 * GANTT_DAY_MS) return hourTicks(start, end, 6, cap);
  if (span <= 16 * GANTT_DAY_MS) return dayTicks(start, end, cap);
  if (span <= 70 * GANTT_DAY_MS) return weekTicks(start, end, cap);
  if (span <= 240 * GANTT_DAY_MS) return monthTicks(start, end, 1, cap);
  if (span <= 800 * GANTT_DAY_MS) return monthTicks(start, end, 3, cap);
  return yearTicks(start, end, cap);
}

export function formatOverviewWindowLabel(window: GanttOverviewWindow): string {
  const start = new Date(window.startMs);
  const end = new Date(overviewWindowEndMs(window) - 1);
  const span = window.spanMs;
  if (span <= 2 * GANTT_DAY_MS) {
    return `${start.getMonth() + 1}/${start.getDate()} ${pad2(start.getHours())}:${pad2(start.getMinutes())} – ${end.getMonth() + 1}/${end.getDate()} ${pad2(end.getHours())}:${pad2(end.getMinutes())}`;
  }
  if (span <= 70 * GANTT_DAY_MS) {
    return `${start.getMonth() + 1}/${start.getDate()} – ${end.getMonth() + 1}/${end.getDate()}`;
  }
  if (span <= 400 * GANTT_DAY_MS) {
    return `${start.getFullYear()}-${pad2(start.getMonth() + 1)} – ${end.getFullYear()}-${pad2(end.getMonth() + 1)}`;
  }
  return `${start.getFullYear()} – ${end.getFullYear()}`;
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

/**
 * Padded, day-snapped fetch range so small pans do not refetch.
 * Visible window stays inside this range until it approaches the edge.
 */
export function overviewFetchWindow(window: GanttOverviewWindow): { start: Date; end: Date } {
  const padMs = Math.max(window.spanMs * 0.5, GANTT_DAY_MS);
  const start = startOfDay(new Date(window.startMs - padMs));
  const endDay = startOfDay(new Date(overviewWindowEndMs(window) + padMs));
  return { start, end: addDays(endDay, 1) };
}

import { addDays, startOfDay, startOfWeek } from "../timeline/dateUtils";
import { clipIntervalToAxis, GANTT_DAY_MS, GANTT_HOUR_MS } from "./ganttTimeGeometry";
import {
  OVERVIEW_COMPACT_WIDTH_PCT,
  OVERVIEW_MIN_TICK_LABEL_PCT,
  OVERVIEW_MIN_TICK_LABEL_PX,
  padOverview2,
  type GanttOverviewWindow,
  type OverviewBarLayout,
  type OverviewTick,
} from "./overviewConstants";
import { overviewInclusiveEndMs, overviewWindowEndMs } from "./overviewWindowOps";

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
      label: `${padOverview2(d.getHours())}:00`,
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
          : `${cursor.getFullYear()}-${padOverview2(month + 1)}`,
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
    return `${start.getMonth() + 1}/${start.getDate()} ${padOverview2(start.getHours())}:${padOverview2(start.getMinutes())} – ${inclusiveEnd.getMonth() + 1}/${inclusiveEnd.getDate()} ${padOverview2(inclusiveEnd.getHours())}:${padOverview2(inclusiveEnd.getMinutes())}`;
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
    return `${labelStart.getFullYear()}-${padOverview2(labelStart.getMonth() + 1)} – ${lastDay.getFullYear()}-${padOverview2(lastDay.getMonth() + 1)}`;
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

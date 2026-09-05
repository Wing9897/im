import { addDays, startOfDay } from "../timeline/dateUtils";
import { GANTT_DAY_MS } from "./ganttTimeGeometry";
import {
  OVERVIEW_FETCH_BUCKET_LONG_MS,
  OVERVIEW_FETCH_BUCKET_SHORT_MS,
  OVERVIEW_FETCH_MAX_MS,
  OVERVIEW_MIN_SPAN_MS,
  type GanttOverviewWindow,
} from "./overviewConstants";
import { clampOverviewWindow, overviewWindowEndMs } from "./overviewWindowOps";

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

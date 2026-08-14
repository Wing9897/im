/**
 * Board Gantt normalize / axis / bar geometry (shared by GanttBoardEmbed).
 */

import {
  calculateAxisBarLayout,
  GANTT_DAY_MS,
  GANTT_HOUR_MS,
} from "../../domain/gantt/ganttTimeGeometry";
import {
  ganttActivityStatusFromRange,
  type GanttActivityStatus,
} from "../../domain/gantt/ganttStatusTokens";
import { groupRecurringGanttRows } from "../../domain/gantt/groupRecurringGanttRows";
import i18n from "../../i18n";
import { getDateTimeLocale } from "../../i18n/locale";
import { timelineEventDateRange } from "../../domain/timeline/dateUtils";
import { getGeneralWorksetLabel } from "../../domain/timeline/userEvents";
import { asTimedAnalysisEvent, type AnalysisEvent, type TaskActivitySpan, type TimelineItem } from "../../types";
import { isWorksetActivitySpan } from "../../types/analysis";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { resolveSpanWorksetId } from "../../domain/tasks/sourceFilterItems";

export interface GanttActivity {
  id: string;
  label: string;
  start: number;
  end: number;
  status: GanttActivityStatus;
  /** Optional task association for filtering / navigation. */
  taskId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

/** One board gantt lane; recurring series may carry multiple segments. */
export interface GanttEventActivityRow {
  id: string;
  label: string;
  status: "active" | "complete";
  taskId?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  segments: GanttActivity[];
}

export interface GanttAxis {
  start: number;
  end: number;
  /** Equal-width cells: hours (day) or days-of-month (month). */
  tickCount: number;
  cellMs: number;
  ticks: { key: string; label: string }[];
}

export interface GanttBarLayout {
  left: number;
  width: number;
  /** 0-based inclusive start cell on the axis. */
  startCell: number;
  /** 0-based exclusive end cell on the axis. */
  endCell: number;
}

function parseMs(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

export function formatActivityRange(start: number, end: number): string {
  const localDateTimeFormatter = new Intl.DateTimeFormat(getDateTimeLocale(), {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${localDateTimeFormatter.format(start)} – ${localDateTimeFormatter.format(end)}`;
}

/**
 * API activity-spans: earliestBatchStart = MIN(completed batch created_at),
 * latestBatchEnd = MAX(completed batch completed_at). Short single-batch runs
 * often span only minutes/hours — month view must still paint a full day cell.
 */
export function normalizeGanttActivities(spans: TaskActivitySpan[], now = Date.now()): GanttActivity[] {
  return spans.flatMap((span) => {
    const start = parseMs(span.earliestBatchStart);
    if (start === null) {
      return [];
    }
    const end = parseMs(span.latestBatchEnd) ?? (span.isActive ? now : start);
    const worksetId = resolveSpanWorksetId(span);
    const isWorkset = isWorksetActivitySpan(span);
    const rowId = isWorkset ? worksetId : span.taskId;
    if (!rowId) {
      return [];
    }
    const worksetLabel =
      worksetId === SYSTEM_WORKSET_ID
        ? getGeneralWorksetLabel()
        : span.taskName.trim() || worksetId || rowId;
    return [{
      id: rowId,
      label: isWorkset
        ? worksetLabel
        : span.taskName.trim() || i18n.t("board:gantt.unnamedTask"),
      start,
      end: Math.max(start, end),
      status: span.isActive ? "active" : "complete",
      taskId: isWorkset ? null : span.taskId,
    }];
  });
}

function eventToSegment(event: TimelineItem, now: number): GanttActivity | null {
  const range = timelineEventDateRange(event);
  const start = range.start.getTime();
  if (Number.isNaN(start)) {
    return null;
  }
  const rawEnd = range.end.getTime();
  const end = Number.isNaN(rawEnd)
    ? start
    : event.isAllDay && event.endTime && rawEnd > start
      ? rawEnd - 1
      : rawEnd;
  return {
    id: event.id,
    label: (event.title || "").trim() || i18n.t("board:gantt.untitled"),
    start,
    end: Math.max(start, end),
    status: ganttActivityStatusFromRange(end, now),
    taskId: event.taskId,
    latitude: event.latitude,
    longitude: event.longitude,
  };
}

/**
 * Analysis events → gantt rows. Prefer real start/end; missing end uses start
 * (min one cell via calculateBar). Events without startTime are skipped.
 * Recurring occurrences sharing a taskId collapse to one row with multiple bars.
 */
export function normalizeGanttEventActivities(
  events: AnalysisEvent[],
  now = Date.now(),
): GanttEventActivityRow[] {
  const timed = events.flatMap((event) => {
    const item = asTimedAnalysisEvent(event);
    return item ? [item] : [];
  });

  return groupRecurringGanttRows(timed).flatMap((row) => {
    const segments = row.occurrences.flatMap((occurrence) => {
      const segment = eventToSegment(occurrence, now);
      return segment ? [segment] : [];
    });
    if (segments.length === 0) {
      return [];
    }
    const representative = segments[0];
    return [{
      id: row.rowId,
      label: row.label || representative.label,
      status: segments.some((segment) => segment.status === "active") ? "active" : "complete",
      taskId: representative.taskId,
      latitude: representative.latitude,
      longitude: representative.longitude,
      segments,
    }];
  });
}

export function activityToSingletonRow(activity: GanttActivity): GanttEventActivityRow {
  return {
    id: activity.id,
    label: activity.label,
    status: activity.status,
    taskId: activity.taskId,
    latitude: activity.latitude,
    longitude: activity.longitude,
    segments: [activity],
  };
}

/**
 * Day = today's local calendar day, one cell per hour (24).
 * Month = current local calendar month, one cell per day.
 */
export function buildGanttAxis(
  viewMode: "day" | "month",
  now = Date.now(),
): GanttAxis {
  const anchor = new Date(now);

  if (viewMode === "day") {
    const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate()).getTime();
    return {
      start,
      end: start + GANTT_DAY_MS,
      tickCount: 24,
      cellMs: GANTT_HOUR_MS,
      ticks: Array.from({ length: 24 }, (_, hour) => ({
        key: `h-${hour}`,
        label: hour % 4 === 0 ? String(hour) : "",
      })),
    };
  }

  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1).getTime();
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1).getTime();
  const tickCount = Math.round((end - start) / GANTT_DAY_MS);
  return {
    start,
    end,
    tickCount,
    cellMs: GANTT_DAY_MS,
    ticks: Array.from({ length: tickCount }, (_, index) => {
      const day = index + 1;
      const show = day === 1 || day === tickCount || day % 5 === 0;
      return { key: `d-${day}`, label: show ? String(day) : "" };
    }),
  };
}

/**
 * Snap bars onto discrete axis cells so left/width match the day/hour grid.
 * Month: short / same-day spans occupy at least one full day cell.
 * Day: short spans occupy at least one full hour cell.
 */
export function calculateBar(activity: GanttActivity, axis: GanttAxis): GanttBarLayout | null {
  return calculateAxisBarLayout(activity.start, activity.end, axis);
}

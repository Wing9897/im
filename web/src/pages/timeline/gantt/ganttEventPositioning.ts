import type { TimelineItem } from "../../../types";
import i18n from "../../../i18n";
import { joinList } from "../../../i18n/formatMessage";
import {
  type TimelineScale,
  startOfDay,
  startOfWeek,
} from "../../../domain/timeline/dateUtils";

export interface EventBarPosition {
  startColumn: number;
  endColumn: number;
  visible: boolean;
  isPoint: boolean;
}

/**
 * 計算單一 TimelineItem 在 grid 中的欄位位置。
 * 純函式，無副作用，適合 property-based testing。
 *
 * day／week／month／quarter／year 用尺度專用 date→column。
 * 畫布甘特的 ms→cell／% 佈局見 `domain/gantt/ganttTimeGeometry`
 *（`calculateAxisBarLayout`）——與本函式共用時間常數與 clip 概念，
 * 但 CSS grid 1-based floor 對應與 board 的 0-based ceil 刻意分開。
 */
export function computeEventBarPosition(
  startTime: Date,
  endTime: Date | null,
  timeScale: TimelineScale,
  rangeStart: Date,
  columnCount: number,
): EventBarPosition {
  if (endTime === null) {
    // Point event: startColumn = endColumn, isPoint = true
    const col = dateToColumn(startTime, timeScale, rangeStart);
    const clipped = Math.max(1, Math.min(columnCount, col));
    const visible = col >= 1 && col <= columnCount;
    return {
      startColumn: clipped,
      endColumn: clipped,
      visible,
      isPoint: true,
    };
  }

  const startCol = dateToColumn(startTime, timeScale, rangeStart);
  const endCol = dateToColumn(endTime, timeScale, rangeStart);

  const clippedStart = Math.max(1, Math.min(columnCount, startCol));
  const clippedEnd = Math.max(clippedStart, Math.min(columnCount, endCol));

  // The bar is visible if it overlaps the visible range [1, columnCount]
  const visible = startCol <= columnCount && endCol >= 1;

  return {
    startColumn: clippedStart,
    endColumn: clippedEnd,
    visible,
    isPoint: false,
  };
}

/**
 * Maps a date to a 1-based column index based on the time scale.
 * - "day": column = hour offset from rangeStart + 1 → columns 1-24
 * - "week": column = day offset from rangeStart + 1 → columns 1-7
 * - "month": column = day offset from rangeStart + 1 → columns 1-31
 * - "quarter": column = week offset from rangeStart + 1 → columns 1-~13
 * - "year": column = month offset from rangeStart + 1 → columns 1-12
 */
function dateToColumn(
  date: Date,
  timeScale: TimelineScale,
  rangeStart: Date,
): number {
  if (timeScale === "day") {
    const dayStart = startOfDay(rangeStart);
    const diffMs = date.getTime() - dayStart.getTime();
    const hourOffset = Math.floor(diffMs / (60 * 60 * 1000));
    return hourOffset + 1;
  }

  if (timeScale === "quarter") {
    // 計算 date 落在第幾週（從 rangeStart 起算）
    const normalizedDate = startOfWeek(date);
    const normalizedRangeStart = startOfWeek(rangeStart);
    const diffMs = normalizedDate.getTime() - normalizedRangeStart.getTime();
    const weekOffset = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
    return weekOffset + 1;
  }

  if (timeScale === "year") {
    // 計算 date 落在第幾月（從 rangeStart 起算）
    const monthOffset =
      (date.getFullYear() - rangeStart.getFullYear()) * 12 +
      (date.getMonth() - rangeStart.getMonth());
    return monthOffset + 1;
  }

  // For week and month scales, column = day offset from rangeStart + 1
  const normalizedDate = startOfDay(date);
  const normalizedRangeStart = startOfDay(rangeStart);
  const diffMs = normalizedDate.getTime() - normalizedRangeStart.getTime();
  const dayOffset = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  return dayOffset + 1;
}

/**
 * 過濾出與可見範圍重疊的事件。
 * event overlaps range if event.startTime < rangeEnd AND (event.endTime ?? event.startTime) >= rangeStart
 */
export function filterVisibleEvents(
  events: TimelineItem[],
  rangeStart: Date,
  rangeEnd: Date,
): TimelineItem[] {
  return events.filter((event) => {
    const start = new Date(event.startTime);
    const end = event.endTime ? new Date(event.endTime) : start;
    return start < rangeEnd && end >= rangeStart;
  });
}

/**
 * 截斷事件標題。
 * 若 title.length > maxLength，回傳前 maxLength 字元加上 "…"；否則原樣回傳。
 */
export function truncateEventTitle(title: string, maxLength: number): string {
  if (title.length <= maxLength) {
    return title;
  }
  return `${title.slice(0, maxLength)}…`;
}

/**
 * 產生事件的工具提示文字，包含標題、時間範圍、地點（若有）、參與者（若有）。
 */
export function buildTooltipContent(event: TimelineItem): string {
  const lines: string[] = [];

  lines.push(event.title);

  // Time range
  const start = new Date(event.startTime);
  const startStr = start.toLocaleString();
  if (event.endTime) {
    const end = new Date(event.endTime);
    const endStr = end.toLocaleString();
    lines.push(`${startStr} — ${endStr}`);
  } else {
    lines.push(startStr);
  }

  // Location
  if (event.location) {
    lines.push(String(i18n.t("timeline:gantt.location", { value: event.location })));
  }

  // Participants
  if ((event.participants ?? []).length > 0) {
    lines.push(
      String(
        i18n.t("timeline:gantt.participants", {
          value: joinList(event.participants ?? []),
        }),
      ),
    );
  }

  return lines.join("\n");
}



/** Fixed pixel width per column — used only for quarter/year horizontal scroll mode. */
export const GANTT_COLUMN_WIDTH_PX = 28;

/** Event lane height (h-7). Labels and chart tracks must share this. */
export const GANTT_LANE_HEIGHT_REM = 1.75;

/**
 * Shared Gantt vertical geometry.
 * Left labels / discrete tracks / 全局 tracks used to drift because the
 * axis spacer (`mb-2` vs `mb-1.5`) and lane box model (border vs none,
 * flex min-size:auto) were not the same string.
 */
export const GANTT_AXIS_HEIGHT_CLASS = "box-border h-5 min-h-5 max-h-5 shrink-0";
export const GANTT_AXIS_FOLLOW_GAP_CLASS = "mb-1.5";
export const GANTT_LANE_HEIGHT_CLASS =
  "box-border h-7 min-h-7 max-h-7 shrink-0 overflow-hidden";
export const GANTT_LANE_STACK_CLASS = "flex min-w-0 flex-col gap-0.5";

export function ganttOverviewGridTemplateRows(laneCount: number): string {
  const lanes = Math.max(0, laneCount);
  if (lanes === 0) return "auto";
  return `auto repeat(${lanes}, minmax(${GANTT_LANE_HEIGHT_REM}rem, auto))`;
}

export function ganttColumnGap(needsScroll: boolean): number {
  // Tight gaps so multi-day bars read as continuous Gantt strips, not a habit grid.
  return needsScroll ? 2 : 1;
}

/**
 * Fit mode (day/week/month): columns share available width — no x-axis scroll.
 * Scroll mode (quarter/year): fixed px columns with horizontal scroll.
 */
export function ganttGridTemplateColumns(columnCount: number, needsScroll: boolean): string {
  if (needsScroll) {
    return `repeat(${columnCount}, ${GANTT_COLUMN_WIDTH_PX}px)`;
  }
  return `repeat(${columnCount}, minmax(0, 1fr))`;
}

export function ganttTimelineMinWidth(columnCount: number, needsScroll: boolean): number | undefined {
  if (!needsScroll) return undefined;
  const gap = ganttColumnGap(needsScroll);
  return columnCount * GANTT_COLUMN_WIDTH_PX + Math.max(0, columnCount - 1) * gap;
}

/** Fixed pixel width per column — used only for quarter/year horizontal scroll mode. */
export const GANTT_COLUMN_WIDTH_PX = 28;

export function ganttColumnGap(needsScroll: boolean): number {
  // Wider gaps make day cells easier to count by eye.
  return needsScroll ? 5 : 4;
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

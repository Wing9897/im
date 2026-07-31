/**
 * Shared Gantt status tokens for Timeline (CSS-grid) and Board (% bars).
 * Presentational class names stay surface-specific; semantics are shared.
 */

export type GanttActivityStatus = "active" | "complete";

/** Board embed bar modifiers (see `board-gantt.css`). Complete uses base bar only. */
export const BOARD_GANTT_BAR_STATUS_CLASS: Record<GanttActivityStatus, string> = {
  active: "board-gantt-embed__bar board-gantt-embed__bar--active",
  complete: "board-gantt-embed__bar",
};

export function boardGanttBarClass(status: GanttActivityStatus): string {
  return BOARD_GANTT_BAR_STATUS_CLASS[status];
}

export function ganttActivityStatusFromRange(
  endMs: number,
  nowMs = Date.now(),
): GanttActivityStatus {
  return endMs >= nowMs ? "active" : "complete";
}

import type { BoardSizePresetId } from "./boardSizePresets";

/** Built-in board widget kinds. */
export type BoardWidgetType =
  | "map"
  | "calendar"
  | "calendar-day"
  | "gantt"
  | "gantt-events"
  | "events"
  | "feed"
  | "queue"
  | "wall"
  | "sources"
  | "leaderboard"
  | "actions"
  | "logs"
  | "tasks"
  | "stats"
  | "system"
  | "clock"
  | "weather"
  | "schedule"
  | "items"
  | "llm-health";

/**
 * Props passed from BoardCanvas to every widget.
 * `active` is false when another widget is maximized (CSS --obscured) or
 * when monitorMode is pages; heavy embeds must not mount while inactive.
 * `widgetId` is the layout instance id (for per-widget local preferences).
 */
export interface BoardWidgetProps {
  active?: boolean;
  widgetId?: string;
}

/**
 * One widget window on the board (grid cell + size preset).
 * Pixel geometry is derived at render time and scaled with the viewport.
 */
export interface BoardWidgetItem {
  i: string;
  type: BoardWidgetType;
  /** Grid column (0-based). */
  col: number;
  /** Grid row (0-based). */
  row: number;
  /** Phone-widget size id, e.g. "4x3". */
  sizeId: BoardSizePresetId;
  /** Stacking order (higher = front). */
  z?: number;
}

/** Persisted board configuration (current = v17). */
export interface BoardConfig {
  version: typeof BOARD_LAYOUT_VERSION;
  widgets: BoardWidgetItem[];
}

export type BoardEditMode = "view" | "edit";

/** Current layout schema version written to server ui-prefs. */
export const BOARD_LAYOUT_VERSION = 17 as const;

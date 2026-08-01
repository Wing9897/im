import { apiClient } from "../client";

export type BoardMapViewPref = {
  center: [number, number];
  zoom: number;
};

/** Per-widget gantt day/month zoom (board gantt widgets). */
export type BoardGanttViewMode = "day" | "month";

/**
 * Per-widget source filter: hierarchical `{taskIds, worksetIds}`, or `null`
 * (all sources). Flat `string[]` is rejected on read (server sanitize may still
 * normalize older SQLite payloads before they reach the client).
 */
export type BoardSourceFilterPref =
  | { taskIds: string[]; worksetIds: string[] }
  | null;

export type BoardWidgetStatePref = {
  mapViews: Record<string, BoardMapViewPref>;
  sourceFilters: Record<string, BoardSourceFilterPref>;
  ganttViewModes: Record<string, BoardGanttViewMode>;
};

/** GET payload after server sanitize (hierarchical only). */
export type BoardWidgetStatePrefWire = BoardWidgetStatePref;

/** Layout blob stored under `ops_board_layout` (v14 widgets mosaic). */
export type BoardLayoutPref = {
  version: number;
  widgets: Array<{
    i: string;
    type: string;
    col: number;
    row: number;
    sizeId: string;
    z?: number;
  }>;
};

export type BoardPrefsResponse = {
  configured: boolean;
  layout: BoardLayoutPref | null;
  widgetState: BoardWidgetStatePrefWire | null;
};

export type BoardPrefsPutBody = {
  /** Omit to leave unchanged; `null` clears the server key. */
  layout?: BoardLayoutPref | null;
  widgetState?: BoardWidgetStatePref | null;
};

const BOARD_PATH = "/api/v1/ui-prefs/board";

/** GET `/api/v1/ui-prefs/board` — empty/missing → `{ configured: false, … null }`. */
export function fetchBoardPrefs(): Promise<BoardPrefsResponse> {
  return apiClient.get<BoardPrefsResponse>(BOARD_PATH);
}

/** PUT `/api/v1/ui-prefs/board` — partial body; returns the merged prefs. */
export function putBoardPrefs(body: BoardPrefsPutBody): Promise<BoardPrefsResponse> {
  return apiClient.put<BoardPrefsResponse>(BOARD_PATH, body);
}

import { apiClient } from "../client";
import type { components } from "../generated/schema";

export type BoardMapViewPref = components["schemas"]["BoardMapViewSchema"];
export type BoardLayoutPref = components["schemas"]["BoardLayoutSchema"];
export type BoardWidgetStatePref = components["schemas"]["BoardWidgetStateSchema"];
export type BoardSourceFilterPref =
  | components["schemas"]["SourceFilterSelectionSchema"]
  | null;
export type BoardGanttViewMode = BoardWidgetStatePref["ganttViewModes"][string];

export type BoardPrefsResponse = components["schemas"]["BoardPrefsResponse"];
export type BoardPrefsPutBody = components["schemas"]["BoardPrefsPutBody"];

const BOARD_PATH = "/api/v1/ui-prefs/board";

/** GET `/api/v1/ui-prefs/board` — empty/missing → `{ configured: false, … null }`. */
export function fetchBoardPrefs(): Promise<BoardPrefsResponse> {
  return apiClient.get<BoardPrefsResponse>(BOARD_PATH);
}

/** PUT `/api/v1/ui-prefs/board` — partial body; returns the merged prefs. */
export function putBoardPrefs(body: BoardPrefsPutBody): Promise<BoardPrefsResponse> {
  return apiClient.put<BoardPrefsResponse>(BOARD_PATH, body);
}

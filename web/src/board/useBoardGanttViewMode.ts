import { useCallback, useState } from "react";
import {
  loadBoardGanttViewModeFromCache,
  saveBoardGanttViewModeToApi,
} from "./boardPrefsStore";
import type { GanttViewMode } from "./widgets/GanttViewModeControls";

const DEFAULT_VIEW_MODE: GanttViewMode = "month";

/** Per-widget gantt day/month zoom via board `widgetState.ganttViewModes`. */
export function useBoardGanttViewMode(widgetId: string | undefined) {
  const [viewMode, setViewModeState] = useState<GanttViewMode>(() => {
    return loadBoardGanttViewModeFromCache(widgetId) ?? DEFAULT_VIEW_MODE;
  });

  const setViewMode = useCallback(
    (mode: GanttViewMode) => {
      setViewModeState(mode);
      saveBoardGanttViewModeToApi(widgetId, mode);
    },
    [widgetId],
  );

  return { viewMode, setViewMode };
}

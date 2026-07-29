import { useCallback, useMemo, useState } from "react";
import {
  catalogOrEventFilterOptions,
  withUserEventsFilterOption,
  type TaskFilterOption,
} from "../domain/timeline/taskFilterOptions";
import {
  loadTaskFilterIdsFromCache,
  saveTaskFilterIdsToApi,
} from "./boardPrefsStore";

export type { TaskFilterOption };

export { catalogOrEventFilterOptions, withUserEventsFilterOption };

/** `null` = show all tasks (default). Non-null = explicit multi-select. */
export function loadTaskFilterIds(widgetId: string | undefined): string[] | null {
  return loadTaskFilterIdsFromCache(widgetId);
}

/** Persist task filter into widgetState (`taskFilters`) via `/api/v1/ui-prefs/board`. */
export function saveTaskFilterIds(widgetId: string | undefined, ids: string[] | null): void {
  saveTaskFilterIdsToApi(widgetId, ids);
}

/** Per-widget task multi-select. `null` means all; empty means none. */
export function useBoardTaskFilter(widgetId: string | undefined) {
  const [selectedTaskIds, setSelectedTaskIdsState] = useState<string[] | null>(() =>
    loadTaskFilterIds(widgetId),
  );

  const setSelectedTaskIds = useCallback(
    (ids: string[] | null) => {
      setSelectedTaskIdsState(ids);
      saveTaskFilterIds(widgetId, ids);
    },
    [widgetId],
  );

  const filterByTaskId = useCallback(
    <T extends { taskId?: string | null }>(items: T[]): T[] => {
      if (selectedTaskIds === null) {
        return items;
      }
      const allowed = new Set(selectedTaskIds);
      return items.filter((item) => item.taskId != null && allowed.has(item.taskId));
    },
    [selectedTaskIds],
  );

  const isFiltering = selectedTaskIds !== null;

  const selectedCount = useMemo(
    () => (isFiltering ? selectedTaskIds.length : 0),
    [isFiltering, selectedTaskIds],
  );

  return {
    selectedTaskIds,
    setSelectedTaskIds,
    filterByTaskId,
    isFiltering,
    selectedCount,
  };
}

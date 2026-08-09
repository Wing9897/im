import { useCallback, useMemo, useState } from "react";
import { useTaskCatalog } from "../context/TaskCatalogContext";
import {
  parseSourceFilterValue,
  resolveAnalysisTaskIdsFromFilter,
  sourceFilterSelectedCount,
  type SourceFilterSelection,
} from "../domain/tasks/sourceFilterSelection";
import {
  filterItemsBySourceSelection,
  type SourceFilterItem,
} from "../domain/tasks/sourceFilterItems";
import {
  loadSourceFilterFromCache,
  saveSourceFilterToApi,
} from "./boardPrefsStore";

function loadBoardSourceFilter(widgetId: string | undefined): SourceFilterSelection {
  return parseSourceFilterValue(loadSourceFilterFromCache(widgetId));
}

function saveSourceFilterIds(
  widgetId: string | undefined,
  selection: SourceFilterSelection,
): void {
  saveSourceFilterToApi(widgetId, selection);
}

/** Per-widget hierarchical source multi-select. `null` means all; empty means none. */
export function useBoardSourceFilter(widgetId: string | undefined) {
  const [selection, setSelectionState] = useState<SourceFilterSelection>(() =>
    loadBoardSourceFilter(widgetId),
  );
  const { tasks } = useTaskCatalog();

  const setSelection = useCallback(
    (next: SourceFilterSelection) => {
      setSelectionState(next);
      saveSourceFilterIds(widgetId, next);
    },
    [widgetId],
  );

  const memberTaskIds = useMemo(() => {
    if (selection === null) return null;
    return new Set(resolveAnalysisTaskIdsFromFilter(selection, tasks) ?? []);
  }, [selection, tasks]);

  const filterBySource = useCallback(
    <T extends SourceFilterItem>(items: T[]): T[] =>
      filterItemsBySourceSelection(items, selection, memberTaskIds),
    [selection, memberTaskIds],
  );

  const isFiltering = selection !== null;

  const selectedCount = useMemo(
    () => (isFiltering ? sourceFilterSelectedCount(selection) : 0),
    [isFiltering, selection],
  );

  return {
    selection,
    setSelection,
    filterBySource,
    isFiltering,
    selectedCount,
  };
}

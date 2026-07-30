import { useCallback, useMemo, useState } from "react";
import { useTaskCatalog } from "../context/TaskCatalogContext";
import {
  catalogOrEventSourceOptions,
  type SourceFilterOption,
} from "../domain/timeline/sourceFilterOptions";
import {
  isEmptySourceFilter,
  parseSourceFilterValue,
  resolveAnalysisTaskIdsFromFilter,
  sourceFilterSelectedCount,
  type SourceFilterSelection,
} from "../domain/tasks/sourceFilterSelection";
import {
  loadSourceFilterFromCache,
  saveSourceFilterToApi,
} from "./boardPrefsStore";

export type { SourceFilterOption };

export { catalogOrEventSourceOptions };

/** Items filterable by board hierarchical source selection. */
export type BoardSourceFilterItem = {
  taskId?: string | null;
  worksetId?: string | null;
  sourceKind?: string | null;
};

/**
 * Resolve ownership workset id for filter / label.
 * Only trusts wire ``worksetId`` when ``sourceKind=workset`` (no ``taskId`` fallback).
 */
export function resolveSpanWorksetId(
  item: Pick<BoardSourceFilterItem, "worksetId" | "sourceKind">,
): string | null {
  if (item.sourceKind !== "workset") return null;
  const fromWire = item.worksetId?.trim();
  return fromWire || null;
}

/** Pure filter used by ``useBoardSourceFilter`` (and unit tests). */
export function filterItemsBySourceSelection<T extends BoardSourceFilterItem>(
  items: T[],
  selection: SourceFilterSelection,
  memberTaskIds: Set<string> | null,
): T[] {
  if (selection === null) {
    return items;
  }
  if (isEmptySourceFilter(selection)) {
    return [];
  }
  const allowTasks = memberTaskIds ?? new Set(selection.taskIds);
  const allowWorksets = new Set(selection.worksetIds);
  return items.filter((item) => {
    // Activity-span ownership rows: wire worksetId only (sourceKind=workset).
    if (item.sourceKind === "workset") {
      const id = resolveSpanWorksetId(item);
      return Boolean(id && allowWorksets.has(id));
    }
    const worksetId = item.worksetId?.trim();
    if (worksetId && allowWorksets.has(worksetId)) return true;
    if (item.taskId != null && item.taskId !== "" && allowTasks.has(item.taskId)) {
      return true;
    }
    return false;
  });
}

function loadBoardSourceFilter(widgetId: string | undefined): SourceFilterSelection {
  return parseSourceFilterValue(loadSourceFilterFromCache(widgetId));
}

/** Persist hierarchical source filter into widgetState via `/api/v1/ui-prefs/board`. */
export function saveSourceFilterIds(
  widgetId: string | undefined,
  selection: SourceFilterSelection,
): void {
  saveSourceFilterToApi(widgetId, selection);
}

/** Load hierarchical source filter from board prefs cache. */
export function loadBoardSourceFilterSelection(
  widgetId: string | undefined,
): SourceFilterSelection {
  return loadBoardSourceFilter(widgetId);
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
    <T extends BoardSourceFilterItem>(items: T[]): T[] =>
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

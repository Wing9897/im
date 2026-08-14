import { useCallback, useEffect, useState } from "react";

import type { SourceFilterSelection } from "../domain/tasks/sourceFilterSelection";
import type { PersistedSourceFilter } from "../domain/ui/persistedSourceFilter";
import { SYSTEM_WORKSET_ID } from "../types/worksets";

/** Minimal catalog shape both Timeline and Intelligence already provide. */
export type SourceFilterCatalogEntry = {
  id: string;
  worksetId?: string | null;
};

export type PersistedSourceFilterState = {
  selectedSources: SourceFilterSelection;
  setSelectedSources: (ids: SourceFilterSelection) => void;
};

/**
 * Persisted source multi-select shared by Timeline and Intelligence.
 *
 * Only the localStorage round-trip lives here. Pruning is a separate hook
 * because both pages need the selection *before* the task catalog that the
 * pruning depends on has been fetched.
 */
export function usePersistedSourceFilter(
  filter: PersistedSourceFilter,
): PersistedSourceFilterState {
  const [selectedSources, setSelectedSourcesState] = useState<SourceFilterSelection>(
    () => filter.load(),
  );

  const setSelectedSources = useCallback(
    (ids: SourceFilterSelection) => {
      setSelectedSourcesState(ids);
      filter.save(ids);
    },
    [filter],
  );

  return { selectedSources, setSelectedSources };
}

/**
 * Prune a persisted selection down to what the catalog still offers (the system
 * workset is always selectable), so a deleted task cannot leave the page
 * filtered to nothing. Skipped while the catalog is still loading.
 */
export function usePruneSourceFilterToCatalog(
  filter: PersistedSourceFilter,
  {
    selectedSources,
    setSelectedSources,
    catalog,
    catalogLoading,
  }: PersistedSourceFilterState & {
    catalog: readonly SourceFilterCatalogEntry[];
    catalogLoading: boolean;
  },
): void {
  useEffect(() => {
    if (catalogLoading) return;
    const catalogIds = catalog.map((entry) => entry.id);
    const worksetIds = [
      SYSTEM_WORKSET_ID,
      ...new Set(
        catalog
          .map((entry) => entry.worksetId)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    ];
    const pruned = filter.prune(selectedSources, catalogIds, worksetIds);
    if (pruned !== selectedSources) {
      setSelectedSources(pruned);
    }
  }, [catalog, catalogLoading, filter, selectedSources, setSelectedSources]);
}

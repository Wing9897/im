import { useCallback, useEffect, useRef, useState } from "react";

import { fetchEvents } from "../../api/results";
import {
  usePagedAsyncResource,
  type PagedResourcePage,
} from "../../hooks/usePagedAsyncResource";
import type { AnalysisEvent } from "../../types";
import { toErrorMessage } from "../../utils/errors";
import { sleep } from "../../utils/sleep";
import {
  INTELLIGENCE_API_PAGE_SIZE,
  isMapSyncAtItemCap,
  MAP_SYNC_LOAD_MORE_PAGES,
  MAP_SYNC_PAGE_RETRIES,
  mergeIntelligencePages,
  type IntelligenceApiDateRange,
  type IntelligenceSortMode,
} from "./intelligenceFeedConfig";

/** True when map fill stopped at the item cap while more remote rows remain. */
function isMapSyncCapped(itemCount: number, apiHasMore: boolean): boolean {
  return isMapSyncAtItemCap(itemCount) && apiHasMore;
}

type IntelligenceFetchKey = {
  searchText: string;
  dateRange: IntelligenceApiDateRange | null;
  sort: IntelligenceSortMode;
  hasCoords: boolean;
  /** `null` = all tasks; `[]` = none; otherwise IN filter (already expanded). */
  resolvedTaskIds: string[] | null;
};

function buildIntelligenceEventsQuery(
  key: IntelligenceFetchKey,
  limit: number,
  offset: number,
) {
  const params: {
    search?: string;
    taskIds?: string[];
    limit: number;
    offset: number;
    startDate?: string;
    endDate?: string;
    sort: IntelligenceSortMode;
    hasCoords?: boolean;
  } = {
    limit,
    offset,
    sort: key.sort,
  };
  if (key.searchText.trim()) params.search = key.searchText.trim();
  if (key.resolvedTaskIds !== null) params.taskIds = key.resolvedTaskIds;
  if (key.dateRange) {
    params.startDate = key.dateRange.startDate;
    params.endDate = key.dateRange.endDate;
  }
  if (key.hasCoords) params.hasCoords = true;
  return params;
}

/**
 * Shared remote events pipeline for intelligence (list/card/map).
 *
 * INVARIANTS (do not “unify” away):
 * - Map fetch key sets `hasCoords: true`; list/card omit it (non-geo events
 *   must remain visible in list/card).
 * - Map auto-fill stops at `MAP_SYNC_MAX_ITEMS`; further pages only via
 *   `loadMoreMapBatch` (user click). Do not attach list infinite-scroll here.
 * - Soft-cap length must be tracked inside the auto-fill loop (React item refs
 *   can lag across back-to-back `append` calls).
 * Regression fences: `useIntelligenceFeed.test.ts` (hasCoords + soft-cap + batch).
 */
export function useIntelligenceSource(
  debouncedSearch: string,
  isMapMode: boolean,
  apiDateRange: IntelligenceApiDateRange | null,
  sortMode: IntelligenceSortMode,
  /** Resolved analysis task ids for the API (`null` = all). */
  resolvedTaskIds: string[] | null,
) {
  const [mapSyncing, setMapSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const fetchPage = useCallback(
    (key: IntelligenceFetchKey, offset: number) =>
      fetchEvents(
        buildIntelligenceEventsQuery(key, INTELLIGENCE_API_PAGE_SIZE, offset),
      ),
    [],
  );

  const {
    items: allItems,
    hasMore: apiHasMore,
    initialLoading,
    isRefreshing,
    loadingMore,
    error: fetchError,
    loadFirst,
    append,
  } = usePagedAsyncResource(fetchPage, {
    mergePages: mergeIntelligencePages,
  });

  const allItemsRef = useRef(allItems);
  const apiHasMoreRef = useRef(apiHasMore);
  allItemsRef.current = allItems;
  apiHasMoreRef.current = apiHasMore;

  const appendRemotePage = useCallback(
    async (): Promise<PagedResourcePage<AnalysisEvent> | null> => append(),
    [append],
  );

  // Map mode: fill a few more pages for the current window (has_coords already
  // on the query). Card/list still paginate on user action only. Past the soft
  // item cap, auto-fill stops; users can call loadMoreMapBatch explicitly.
  useEffect(() => {
    if (!isMapMode || initialLoading || isRefreshing || !apiHasMore) return;
    if (isMapSyncAtItemCap(allItemsRef.current.length)) return;

    let cancelled = false;
    setMapSyncing(true);

    void (async () => {
      try {
        let filledCount = allItemsRef.current.length;
        while (!cancelled && apiHasMoreRef.current) {
          if (isMapSyncAtItemCap(filledCount)) break;

          let page: PagedResourcePage<AnalysisEvent> | null = null;
          for (let retry = 0; retry <= MAP_SYNC_PAGE_RETRIES; retry++) {
            if (cancelled) break;
            try {
              page = await append();
            } catch (syncFailure: unknown) {
              if (retry === MAP_SYNC_PAGE_RETRIES) {
                throw syncFailure;
              }
              page = null;
            }
            if (page) break;
            await sleep(50 * (retry + 1));
          }

          if (cancelled) break;
          if (!page) break;
          // Prefer live React length when flushed; otherwise accumulate page size
          // so the soft cap still holds across back-to-back appends.
          filledCount = Math.max(
            allItemsRef.current.length,
            filledCount + (page.items?.length ?? 0),
          );
          if (!(page.hasMore ?? false)) break;
        }
      } catch (syncFailure: unknown) {
        if (!cancelled) {
          setSyncError(toErrorMessage(syncFailure));
        }
      } finally {
        if (!cancelled) setMapSyncing(false);
      }
    })();

    return () => {
      cancelled = true;
      setMapSyncing(false);
    };
  }, [apiHasMore, append, initialLoading, isMapMode, isRefreshing]);

  const resolvedTaskIdsKey =
    resolvedTaskIds === null ? "*" : resolvedTaskIds.join("|");

  useEffect(() => {
    setSyncError(null);
    void loadFirst({
      searchText: debouncedSearch,
      dateRange: apiDateRange,
      sort: sortMode,
      hasCoords: isMapMode,
      resolvedTaskIds,
    });
    // Depend on resolvedTaskIdsKey (content) rather than array identity.
  }, [loadFirst, debouncedSearch, apiDateRange, sortMode, isMapMode, resolvedTaskIdsKey]); // eslint-disable-line react-hooks/exhaustive-deps -- resolvedTaskIds mirrored by key

  const refreshItems = useCallback(async () => {
    setSyncError(null);
    await loadFirst({
      searchText: debouncedSearch,
      dateRange: apiDateRange,
      sort: sortMode,
      hasCoords: isMapMode,
      resolvedTaskIds,
    });
  }, [apiDateRange, debouncedSearch, isMapMode, loadFirst, resolvedTaskIds, sortMode]);

  /** Explicit map batch beyond the soft auto-cap (one click ≈ one API page). */
  const loadMoreMapBatch = useCallback(async () => {
    if (
      !isMapMode ||
      initialLoading ||
      isRefreshing ||
      mapSyncing ||
      loadingMore
    ) {
      return;
    }
    if (!isMapSyncCapped(allItemsRef.current.length, apiHasMoreRef.current)) {
      return;
    }

    setSyncError(null);
    try {
      for (let pageIndex = 0; pageIndex < MAP_SYNC_LOAD_MORE_PAGES; pageIndex++) {
        if (!apiHasMoreRef.current) break;

        let page: PagedResourcePage<AnalysisEvent> | null = null;
        for (let retry = 0; retry <= MAP_SYNC_PAGE_RETRIES; retry++) {
          try {
            page = await append();
          } catch (batchFailure: unknown) {
            if (retry === MAP_SYNC_PAGE_RETRIES) {
              throw batchFailure;
            }
            page = null;
          }
          if (page) break;
          await sleep(50 * (retry + 1));
        }

        if (!page) break;
        if (!(page.hasMore ?? false)) break;
      }
    } catch (batchFailure: unknown) {
      setSyncError(toErrorMessage(batchFailure));
    }
  }, [
    append,
    initialLoading,
    isMapMode,
    isRefreshing,
    loadingMore,
    mapSyncing,
  ]);

  const mapSyncAtCap =
    isMapMode && !mapSyncing && isMapSyncCapped(allItems.length, apiHasMore);

  return {
    allItems,
    apiHasMore,
    initialLoading,
    isRefreshing,
    loadingMore,
    mapSyncing,
    mapSyncAtCap,
    fetchError,
    syncError,
    appendRemotePage,
    loadMoreMapBatch,
    refreshItems,
  };
}

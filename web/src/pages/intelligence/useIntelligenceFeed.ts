import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTaskCatalog } from "../../context/TaskCatalogContext";
import {
  loadIntelligenceSelectedTaskIds,
  pruneIntelligenceSelectedTaskIds,
  saveIntelligenceSelectedTaskIds,
  type IntelligenceSelectedTaskIds,
} from "../../domain/intelligence/intelligenceTaskFilter";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll";
import { usePersistedState } from "../../hooks/usePersistedState";
import { usePersistedViewMode } from "../../hooks/usePersistedViewMode";
import { useRefreshOnAnalysisEvent } from "../../hooks/useRefreshOnAnalysisEvent";
import { useTimeFilter } from "../../hooks/useTimeFilter";
import type { TimeWindow } from "../../types";
import { toErrorMessage } from "../../utils/errors";
import {
  getLoadMoreHint,
  INTELLIGENCE_PAGE_SIZE,
  timeWindowToApiParams,
  type IntelligenceSortMode,
} from "./intelligenceFeedConfig";
import {
  INTELLIGENCE_SEARCH_STORAGE_KEY,
  INTELLIGENCE_SORT_STORAGE_KEY,
  INTELLIGENCE_TIME_PRESET_STORAGE_KEY,
  INTELLIGENCE_VIEW_MODE_STORAGE_KEY,
} from "../../domain/intelligence/intelligencePersistedKeys";
import { useIntelligenceSource } from "./useIntelligenceSource";

/**
 * List/card/map view-state over one remote source (`useIntelligenceSource`).
 *
 * INVARIANTS (do not “unify” away):
 * - TimeWindow ownership is dual on purpose:
 *   - List/card: `useTimeFilter` (`timeWindow`) only.
 *   - Map: `useMapView` → `handleMapFetchWindowChange` → `mapApiWindow`.
 *   Never collapse both onto a single `useTimeFilter` (kills Live ± hours).
 * - List/card pagination: `visibleCount` + infinite scroll (`loadMoreItems`).
 * - Map pagination: soft auto-cap + explicit `loadMoreMapBatch` (not infinite scroll).
 * - Do not wire map scrub previews into `loadFirst` / `apiDateRange` here.
 * Regression fences: `useIntelligenceFeed.test.ts`, `intelligenceFeedConfig.test.ts`.
 */
export function useIntelligenceFeed() {
  const { tasks, tasksLoading, taskLoadError } = useTaskCatalog();
  const [visibleCount, setVisibleCount] = useState(INTELLIGENCE_PAGE_SIZE);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  /** Map-owned fetch window; ignored outside map mode. */
  const [mapApiWindow, setMapApiWindow] = useState<TimeWindow | null>(null);

  const [viewMode, setViewMode] = usePersistedViewMode(
    INTELLIGENCE_VIEW_MODE_STORAGE_KEY,
    "map",
  );
  const [search, setSearch] = usePersistedState(INTELLIGENCE_SEARCH_STORAGE_KEY, "", {
    persistDebounceMs: 400,
    storage: "session",
  });
  const [selectedTaskIds, setSelectedTaskIdsState] =
    useState<IntelligenceSelectedTaskIds>(() => loadIntelligenceSelectedTaskIds());
  const setSelectedTaskIds = useCallback((ids: IntelligenceSelectedTaskIds) => {
    setSelectedTaskIdsState(ids);
    saveIntelligenceSelectedTaskIds(ids);
  }, []);
  const [sortMode, setSortMode] = usePersistedState<IntelligenceSortMode>(
    INTELLIGENCE_SORT_STORAGE_KEY,
    "event_time",
  );
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const { selectedPreset, setPreset, timeWindow, refreshRollingWindow } =
    useTimeFilter("today", { storageKey: INTELLIGENCE_TIME_PRESET_STORAGE_KEY });
  const [loadMoreNode, setLoadMoreNode] = useState<HTMLDivElement | null>(null);

  const isMapMode = viewMode === "map";
  const prevIsMapModeRef = useRef(isMapMode);

  const intelligenceTasks = useMemo(
    () => tasks.filter((task) => task.analysisMode === "event"),
    [tasks],
  );

  useEffect(() => {
    if (tasksLoading) return;
    const catalogIds = intelligenceTasks.map((task) => task.id);
    const pruned = pruneIntelligenceSelectedTaskIds(selectedTaskIds, catalogIds);
    if (pruned !== selectedTaskIds) {
      setSelectedTaskIds(pruned);
    }
  }, [intelligenceTasks, selectedTaskIds, setSelectedTaskIds, tasksLoading]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const apiDateRange = useMemo(() => {
    const window = isMapMode ? mapApiWindow : timeWindow;
    if (!window) return null;
    return timeWindowToApiParams(window);
  }, [isMapMode, mapApiWindow, timeWindow]);

  const {
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
  } = useIntelligenceSource(
    debouncedSearch,
    isMapMode,
    apiDateRange,
    sortMode,
    selectedTaskIds,
  );

  useEffect(() => {
    if (isMapMode) return;
    const interval = setInterval(() => {
      refreshRollingWindow();
    }, 60_000);
    return () => clearInterval(interval);
  }, [isMapMode, refreshRollingWindow]);

  useEffect(() => {
    if (prevIsMapModeRef.current && !isMapMode) {
      refreshRollingWindow();
    }
    prevIsMapModeRef.current = isMapMode;
  }, [isMapMode, refreshRollingWindow]);

  useEffect(() => {
    setVisibleCount(INTELLIGENCE_PAGE_SIZE);
  }, [
    debouncedSearch,
    timeWindow,
    selectedPreset,
    viewMode,
    apiDateRange,
    sortMode,
    selectedTaskIds,
  ]);

  const items = useMemo(
    () => (isMapMode ? allItems : allItems.slice(0, visibleCount)),
    [allItems, isMapMode, visibleCount],
  );

  const hasMoreCached = !isMapMode && visibleCount < allItems.length;
  const hasMoreRemote = !isMapMode && apiHasMore;
  const hasMore = hasMoreCached || hasMoreRemote;

  const loadMoreHint = useMemo(
    () =>
      getLoadMoreHint({
        loadingMore,
        hasMoreCached,
        hasMoreRemote,
        hasIntelligenceItems: items.length > 0,
      }),
    [items.length, hasMoreCached, hasMoreRemote, loadingMore],
  );

  const isBusy = isRefreshing || mapSyncing;

  const loadMoreItems = useCallback(async () => {
    if (isMapMode || initialLoading || isRefreshing || loadingMore || !hasMore) {
      return;
    }

    if (hasMoreCached) {
      setVisibleCount((count) =>
        Math.min(count + INTELLIGENCE_PAGE_SIZE, allItems.length),
      );
      return;
    }

    if (!hasMoreRemote) return;

    setLoadMoreError(null);
    try {
      await appendRemotePage();
      setVisibleCount((count) => count + INTELLIGENCE_PAGE_SIZE);
    } catch (loadError: unknown) {
      setLoadMoreError(toErrorMessage(loadError));
    }
  }, [
    appendRemotePage,
    hasMore,
    hasMoreCached,
    hasMoreRemote,
    initialLoading,
    isMapMode,
    isRefreshing,
    loadingMore,
    allItems.length,
  ]);

  useRefreshOnAnalysisEvent(refreshItems, {
    taskIds: selectedTaskIds,
    analysisMode: "event",
  });

  useInfiniteScroll({
    triggerNode: loadMoreNode,
    onLoadMore: loadMoreItems,
    // Keep observer mounted while a page is in flight; loadMoreItems guards
    // concurrency. Toggling disabled on loadingMore remounts and can chain.
    disabled: initialLoading || isMapMode || !hasMore,
    // Page scroll owns the feed (no inner boxed scroller).
    root: null,
    rootMargin: "0px 0px 240px 0px",
  });

  const pageError = fetchError ?? loadMoreError ?? syncError ?? taskLoadError;
  const hasSearchFilter = search.trim().length > 0;
  const hasTimeFilter = selectedPreset !== "today";
  const hasTaskFilter = selectedTaskIds !== null;
  const hasActiveFilters = hasSearchFilter || hasTimeFilter || hasTaskFilter;
  const resetFilters = useCallback(() => {
    setSearch("");
    setPreset("today");
    setSelectedTaskIds(null);
  }, [setSearch, setPreset, setSelectedTaskIds]);

  const handleMapFetchWindowChange = useCallback((window: TimeWindow) => {
    setMapApiWindow(window);
  }, []);

  return {
    items,
    allItems,
    viewMode,
    setViewMode,
    loading: initialLoading,
    isRefreshing,
    mapSyncing,
    mapSyncAtCap,
    isBusy,
    loadingMore,
    hasMore,
    hasMoreCached,
    hasMoreRemote,
    loadMoreHint,
    search,
    setSearch,
    debouncedSearch,
    selectedTaskIds,
    setSelectedTaskIds,
    intelligenceTasks,
    loadMoreItems,
    loadMoreMapBatch,
    setLoadMoreTriggerRef: setLoadMoreNode,
    pageError,
    hasActiveFilters,
    hasSearchFilter,
    hasTimeFilter,
    hasTaskFilter,
    resetFilters,
    refreshItems,
    isMapMode,
    sortMode,
    setSortMode,
    selectedPreset,
    setPreset,
    handleMapFetchWindowChange,
  };
}

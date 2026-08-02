import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useTaskCatalog } from "../../context/TaskCatalogContext";
import { intelligenceSelectedSourcesFilter } from "../../domain/ui/namedSourceFilters";
import type { SourceFilterSelection } from "../../domain/tasks/sourceFilterSelection";
import { ANALYSIS_EVENTS_MODES, isAnalysisEventsMode } from "../../domain/tasks/analysisModeCapabilities";
import { resolveAnalysisTaskIdsFromFilter } from "../../domain/tasks/sourceFilterSelection";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll";
import { usePersistedState, usePersistedViewMode } from "../../hooks/usePersistedState";
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
} from "../../domain/prefs";
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
  const [selectedSources, setSelectedSourcesState] =
    useState<SourceFilterSelection>(() => intelligenceSelectedSourcesFilter.load());
  const setSelectedSources = useCallback((ids: SourceFilterSelection) => {
    setSelectedSourcesState(ids);
    intelligenceSelectedSourcesFilter.save(ids);
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
    () => tasks.filter((task) => isAnalysisEventsMode(task.analysisMode)),
    [tasks],
  );

  useEffect(() => {
    if (tasksLoading) return;
    const catalogIds = intelligenceTasks.map((task) => task.id);
    const worksetIds = [
      SYSTEM_WORKSET_ID,
      ...new Set(
        intelligenceTasks
          .map((task) => task.worksetId)
          .filter((id): id is string => typeof id === "string" && id.length > 0),
      ),
    ];
    const pruned = intelligenceSelectedSourcesFilter.prune(selectedSources, catalogIds, worksetIds);
    if (pruned !== selectedSources) {
      setSelectedSources(pruned);
    }
  }, [intelligenceTasks, selectedSources, setSelectedSources, tasksLoading]);

  const resolvedApiTaskIds = useMemo(() => {
    const fromFilter = resolveAnalysisTaskIdsFromFilter(selectedSources, intelligenceTasks);
    if (fromFilter !== null) return fromFilter;
    // "All sources" on Intelligence = all event/web_intel tasks, not every DB task.
    // While the catalog is still loading, keep null so we do not flash an empty IN [].
    if (tasksLoading) return null;
    return intelligenceTasks.map((task) => task.id).sort();
  }, [selectedSources, intelligenceTasks, tasksLoading]);

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
    resolvedApiTaskIds,
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
    selectedSources,
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
    taskIds: resolvedApiTaskIds,
    analysisMode: ANALYSIS_EVENTS_MODES,
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
  const hasSourceFilter = selectedSources !== null;
  const hasActiveFilters = hasSearchFilter || hasTimeFilter || hasSourceFilter;
  const resetFilters = useCallback(() => {
    setSearch("");
    setPreset("today");
    setSelectedSources(null);
  }, [setSearch, setPreset, setSelectedSources]);

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
    selectedSources,
    setSelectedSources,
    intelligenceTasks,
    loadMoreItems,
    loadMoreMapBatch,
    setLoadMoreTriggerRef: setLoadMoreNode,
    pageError,
    hasActiveFilters,
    hasSearchFilter,
    hasTimeFilter,
    hasSourceFilter,
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

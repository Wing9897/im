import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useAnalysisStatus } from "../../context/AnalysisStatusContext";
import { useRuntimeLogs } from "../../context/runtimeLogs/RuntimeLogsContext";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll";
import { usePersistedState } from "../../hooks/usePersistedState";
import {
  LOGS_CATEGORY_FILTER_STORAGE_KEY,
  LOGS_LEVEL_FILTER_STORAGE_KEY,
  LOGS_SEARCH_STORAGE_KEY,
  LOGS_SELECTED_ID_STORAGE_KEY,
} from "./logsPersistedKeys";

const validLogLevels = new Set(["all", "info", "success", "warning", "error"]);
const validLogCategories = new Set([
  "all",
  "analysis",
  "collector",
  "account",
  "system",
  "frontend",
]);

export function useLogPage() {
  const {
    logs,
    totalLogCount,
    hasMoreLogs,
    logsLoading,
    logsLoadingMore,
    logLoadError,
    clearLogs,
    refreshLogs,
    loadMoreLogs,
  } = useRuntimeLogs();
  const { activeAnalysis } = useAnalysisStatus();
  const [selectedLogId, setSelectedLogId] = usePersistedState<string | null>(
    LOGS_SELECTED_ID_STORAGE_KEY,
    null,
  );
  const [loadMoreNode, setLoadMoreNode] = useState<HTMLDivElement | null>(null);
  const [scrollContainerNode, setScrollContainerNode] =
    useState<HTMLDivElement | null>(null);
  const [levelFilter, setLevelFilter] = usePersistedState(
    LOGS_LEVEL_FILTER_STORAGE_KEY,
    "all",
  );
  const [categoryFilter, setCategoryFilter] = usePersistedState(
    LOGS_CATEGORY_FILTER_STORAGE_KEY,
    "all",
  );
  const [search, setSearch] = usePersistedState(LOGS_SEARCH_STORAGE_KEY, "", {
    persistDebounceMs: 400,
    storage: "session",
  });
  const [showLoadingHint, setShowLoadingHint] = useState(false);
  const [showStuckLoadingHint, setShowStuckLoadingHint] = useState(false);
  const [manuallyRefreshing, setManuallyRefreshing] = useState(false);

  const normalizedLevelFilter = validLogLevels.has(levelFilter)
    ? levelFilter
    : "all";
  const normalizedCategoryFilter = validLogCategories.has(categoryFilter)
    ? categoryFilter
    : "all";

  const handleRefreshLogs = useCallback(async () => {
    setManuallyRefreshing(true);
    try {
      await refreshLogs();
    } finally {
      setManuallyRefreshing(false);
    }
  }, [refreshLogs]);

  const handleLoadMoreLogs = useCallback(async () => {
    await loadMoreLogs();
  }, [loadMoreLogs]);

  useEffect(() => {
    if (levelFilter !== normalizedLevelFilter) {
      setLevelFilter(normalizedLevelFilter);
    }
  }, [levelFilter, normalizedLevelFilter, setLevelFilter]);

  useEffect(() => {
    if (categoryFilter !== normalizedCategoryFilter) {
      setCategoryFilter(normalizedCategoryFilter);
    }
  }, [categoryFilter, normalizedCategoryFilter, setCategoryFilter]);

  useEffect(() => {
    if (!logsLoading) {
      setShowLoadingHint(false);
      setShowStuckLoadingHint(false);
      return;
    }
    const hintTimer = window.setTimeout(() => {
      setShowLoadingHint(true);
    }, 400);
    const stuckTimer = window.setTimeout(() => {
      setShowStuckLoadingHint(true);
    }, 6_000);
    return () => {
      window.clearTimeout(hintTimer);
      window.clearTimeout(stuckTimer);
    };
  }, [logsLoading]);

  useInfiniteScroll({
    triggerNode: loadMoreNode,
    onLoadMore: handleLoadMoreLogs,
    disabled: logsLoading || !hasMoreLogs,
    root: scrollContainerNode,
    rootMargin: "0px 0px 240px 0px",
  });

  const deferredSearch = useDeferredValue(search);

  const filteredLogs = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    return logs.filter((entry) => {
      if (
        normalizedLevelFilter !== "all" &&
        entry.level !== normalizedLevelFilter
      ) {
        return false;
      }
      if (
        normalizedCategoryFilter !== "all" &&
        entry.category !== normalizedCategoryFilter
      ) {
        return false;
      }
      if (!query) {
        return true;
      }
      return `${entry.message}\n${entry.details ?? ""}`
        .toLowerCase()
        .includes(query);
    });
  }, [logs, normalizedCategoryFilter, normalizedLevelFilter, deferredSearch]);

  const errorCount = useMemo(
    () => logs.filter((entry) => entry.level === "error").length,
    [logs],
  );
  const analysisCount = useMemo(
    () => logs.filter((entry) => entry.category === "analysis").length,
    [logs],
  );
  const loadedLogsSummary = `${logs.length} / ${totalLogCount}`;
  const hasActiveFilters =
    normalizedLevelFilter !== "all" ||
    normalizedCategoryFilter !== "all" ||
    search.trim().length > 0;
  const selectedLog = selectedLogId
    ? (filteredLogs.find((entry) => entry.id === selectedLogId) ?? null)
    : null;
  const showLoadingState =
    logsLoading &&
    logs.length === 0 &&
    showLoadingHint &&
    !showStuckLoadingHint &&
    !logLoadError;
  const showLoadRecoveryState =
    logs.length === 0 &&
    ((logsLoading && (showStuckLoadingHint || Boolean(logLoadError))) ||
      (!logsLoading && Boolean(logLoadError)));

  const resetFilters = useCallback(() => {
    setLevelFilter("all");
    setCategoryFilter("all");
    setSearch("");
  }, [setLevelFilter, setCategoryFilter, setSearch]);

  return {
    logs,
    totalLogCount,
    hasMoreLogs,
    logsLoadingMore,
    logLoadError,
    activeAnalysis,
    clearLogs,
    selectedLogId,
    setSelectedLogId,
    setLoadMoreNode,
    setScrollContainerNode,
    search,
    setSearch,
    normalizedLevelFilter,
    setLevelFilter,
    normalizedCategoryFilter,
    setCategoryFilter,
    manuallyRefreshing,
    handleRefreshLogs,
    handleLoadMoreLogs,
    filteredLogs,
    errorCount,
    analysisCount,
    loadedLogsSummary,
    hasActiveFilters,
    selectedLog,
    showLoadingState,
    showLoadRecoveryState,
    resetFilters,
  };
}

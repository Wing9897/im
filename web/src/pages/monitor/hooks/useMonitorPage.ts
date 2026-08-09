import { useMonitorData } from "./useMonitorData";
import { useMonitorHandlers } from "./useMonitorHandlers";

/**
 * Monitor page hook — composes data fetching and UI handler sub-hooks.
 *
 * Split into:
 * - `useMonitorData` — data fetching, pagination, live updates
 * - `useMonitorHandlers` — event handlers, scroll tracking, derived view state
 */
export function useMonitorPage() {
  const {
    messages,
    sources,
    channels,
    channelsReady,
    filters,
    setFilters,
    viewMode,
    setViewMode,
    initialLoading,
    isRefreshing,
    loadingMore,
    hasMore,
    totalCount,
    statsLoading,
    primaryError,
    loadMoreError,
    metadataError,
    loadMoreMessages,
    refreshMessages,
    retryMetadataLoad,
  } = useMonitorData();

  const {
    listWindow,
    hasActiveFilters,
    setLoadMoreTriggerRef,
    setListContainerRef,
    handleFiltersChange,
    handleLoadMoreAction,
    resetFilters,
  } = useMonitorHandlers({
    messages,
    filters,
    setFilters,
    viewMode,
    primaryFetchActive: initialLoading || isRefreshing,
    hasMore,
    loadMoreMessages,
  });

  const retryPrimaryLoad = () => refreshMessages(filters);

  const retryStreamError = () => {
    if (primaryError) {
      void retryPrimaryLoad();
      return;
    }
    if (loadMoreError) {
      void handleLoadMoreAction();
      return;
    }
    retryMetadataLoad();
  };

  return {
    messages,
    sources,
    channels,
    channelsReady,
    filters,
    viewMode,
    initialLoading,
    isRefreshing,
    loadingMore,
    hasMore,
    totalCount,
    statsLoading,
    metadataError,
    error: primaryError ?? loadMoreError ?? metadataError,
    listWindow,
    hasActiveFilters,
    setLoadMoreTriggerRef,
    setListContainerRef,
    handleFiltersChange,
    handleLoadMoreAction,
    resetFilters,
    setViewMode,
    retryStreamError,
    retryMetadataLoad,
  };
}

import { useCallback, useMemo, useState } from "react";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll";
import { useScrollContainerState } from "../../hooks/useScrollContainerState";
import type { Message, MessageFilters } from "../../types";
import type { MonitorViewMode } from "../../domain/monitor/monitorViewMode";
import {
  getMessageListWindow,
  hasActiveMessageFilters,
} from "./monitorPageModel";

interface UseMonitorHandlersOptions {
  messages: Message[];
  filters: MessageFilters;
  setFilters: (filters: MessageFilters) => void;
  viewMode: MonitorViewMode;
  /** Primary page fetch in flight (initial or refresh). */
  primaryFetchActive: boolean;
  hasMore: boolean;
  loadMoreMessages: () => Promise<void>;
}

/**
 * Handles UI event handlers and derived view state for the Monitor page.
 * Card and list share the same infinite-scroll contract: scroll the feed
 * container until the footer sentinel enters, then fetch the next page.
 */
export function useMonitorHandlers({
  messages,
  filters,
  setFilters,
  viewMode,
  primaryFetchActive,
  hasMore,
  loadMoreMessages,
}: UseMonitorHandlersOptions) {
  const [loadMoreNode, setLoadMoreNode] = useState<HTMLDivElement | null>(null);
  const [listContainerNode, setListContainerNode] =
    useState<HTMLDivElement | null>(null);

  const listScrollEnabled = viewMode === "list" || viewMode === "card";
  const { tick } = useScrollContainerState(listContainerNode, {
    enabled: listScrollEnabled,
    extraDeps: [messages.length, viewMode],
  });

  const handleFiltersChange = useCallback(
    (next: MessageFilters) => setFilters(next),
    [setFilters],
  );

  const handleLoadMoreAction = useCallback(async () => {
    await loadMoreMessages();
  }, [loadMoreMessages]);

  useInfiniteScroll({
    triggerNode: loadMoreNode,
    onLoadMore: handleLoadMoreAction,
    disabled: primaryFetchActive || !hasMore,
    // Page scroll owns the feed (flush list/card — no inner boxed scroller).
    root: null,
    rootMargin: "0px 0px 240px 0px",
  });

  // `tick` forces virtual window recalculation on scroll/resize.
  const listWindow = useMemo(
    () =>
      getMessageListWindow({
        viewMode,
        messages,
        listContainerNode,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tick drives viewport reread
    [viewMode, messages, listContainerNode, tick],
  );

  const hasActiveFilters = hasActiveMessageFilters(filters);
  const resetFilters = useCallback(() => setFilters({}), [setFilters]);

  return {
    listWindow,
    hasActiveFilters,
    setLoadMoreTriggerRef: setLoadMoreNode,
    setListContainerRef: setListContainerNode,
    handleFiltersChange,
    handleLoadMoreAction,
    resetFilters,
  };
}

import {
  useCallback,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import type { Message, MessageCursor, MessageFilters, MessagePage } from "../../../types";
import { toErrorMessage } from "../../../utils/errors";
import { useLatestRequest } from "../../../hooks/useLatestRequest";
import { mergeUniqueMessages } from "../../../domain/monitor/monitorPageModel";

type LatestRequestHandle = ReturnType<typeof useLatestRequest>;

interface UseMonitorPagingOptions {
  filters: MessageFilters;
  primaryFetchActive: boolean;
  messagesRef: MutableRefObject<Message[]>;
  loadMoreRequest: LatestRequestHandle;
  fetchPage: (filters: MessageFilters, cursor: MessageCursor | null) => Promise<MessagePage>;
  setMessages: Dispatch<SetStateAction<Message[]>>;
  setTotalCount: Dispatch<SetStateAction<number>>;
}

/**
 * Cursor pagination for the Monitor message stream.
 */
export function useMonitorPaging({
  filters,
  primaryFetchActive,
  messagesRef,
  loadMoreRequest,
  fetchPage,
  setMessages,
  setTotalCount,
}: UseMonitorPagingOptions) {
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<MessageCursor | null>(null);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  const resetPagingForRefresh = useCallback(() => {
    loadMoreRequest.begin();
    setLoadingMore(false);
  }, [loadMoreRequest]);

  const applyPrimaryPageMeta = useCallback(
    (page: MessagePage, preservedSseCount: number) => {
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore ?? false);
      setTotalCount((page.totalCount ?? 0) + preservedSseCount);
    },
    [setTotalCount],
  );

  const loadMoreMessages = useCallback(async () => {
    if (!hasMore || loadingMore || primaryFetchActive || !nextCursor) return;

    setLoadingMore(true);
    setLoadMoreError(null);
    const queryVersion = loadMoreRequest.begin();
    try {
      const page = await fetchPage(filters, nextCursor);
      if (!loadMoreRequest.isCurrent(queryVersion)) return;
      const pageMessages = page.messages ?? [];
      setMessages((current) => {
        const merged = mergeUniqueMessages(current, pageMessages, "append");
        messagesRef.current = merged;
        return merged;
      });
      setNextCursor(page.nextCursor);
      setHasMore(page.hasMore ?? false);
      if (page.totalCount !== null) {
        setTotalCount((current) => Math.max(current, page.totalCount ?? 0));
      }
    } catch (e) {
      if (!loadMoreRequest.isCurrent(queryVersion)) return;
      setLoadMoreError(toErrorMessage(e));
    } finally {
      if (loadMoreRequest.isCurrent(queryVersion)) setLoadingMore(false);
    }
  }, [
    fetchPage,
    filters,
    hasMore,
    loadMoreRequest,
    loadingMore,
    messagesRef,
    nextCursor,
    primaryFetchActive,
    setMessages,
    setTotalCount,
  ]);

  return {
    loadingMore,
    hasMore,
    nextCursor,
    loadMoreError,
    loadMoreMessages,
    resetPagingForRefresh,
    applyPrimaryPageMeta,
  };
}

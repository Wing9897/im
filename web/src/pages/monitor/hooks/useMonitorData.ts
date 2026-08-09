import { useCallback, useEffect, useRef, useState } from "react";
import { queryMessagesPage } from "../../../api/messages";
import { useAsyncResource } from "../../../hooks/useAsyncResource";
import { loadPhase } from "../../../hooks/loadPhase";
import { useLatestRequest } from "../../../hooks/useLatestRequest";
import type { Message, MessageCursor, MessageFilters, MessagePage } from "../../../types";
import { captureError } from "../../../utils/errorReporter";
import {
  PAGE_SIZE,
  matchesFilters,
  mergeUniqueMessages,
} from "../monitorPageModel";
import { useMonitorInitialLoad } from "./useMonitorInitialLoad";
import { useMonitorPaging } from "./useMonitorPaging";
import { useMonitorSseMerge } from "./useMonitorSseMerge";

const fetchMessagesPage = (
  filters: MessageFilters,
  cursor: MessageCursor | null,
): Promise<MessagePage> =>
  queryMessagesPage({
    filters,
    cursor,
    limit: PAGE_SIZE,
    includeTotal: cursor === null,
  });

/**
 * Monitor fetch / pagination / live updates.
 *
 * INVARIANTS:
 * - Refresh must rebase over SSE arrivals (`sseSequenceRef` / `sseMessagesRef`) —
 *   never `setMessages(page)` in a way that drops live prepends.
 * - `streamEnabled` forks stream list merge vs wall total-only increments
 *   (`useMonitorSseMerge`). Do not use stream merge logic in wall mode.
 * - Periodic full-list polling was removed on purpose; SSE + explicit refresh only.
 * Regression fences: `useMonitorData.test.ts`.
 */
export function useMonitorData() {
  const {
    sources,
    channels,
    channelsReady,
    filters,
    setFilters,
    viewMode,
    setViewMode,
    streamEnabled,
    metadataError,
    retryMetadataLoad,
  } = useMonitorInitialLoad();

  const [messages, setMessages] = useState<Message[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const loadMoreRequest = useLatestRequest();
  const messagesRef = useRef<Message[]>([]);

  const { sseSequenceRef, sseMessagesRef, wallSseCountRef } = useMonitorSseMerge({
    filters,
    streamEnabled,
    messagesRef,
    setMessages,
    setTotalCount,
  });

  const messagesFetcher = useCallback(
    (f: MessageFilters) => fetchMessagesPage(f, null),
    [],
  );
  const {
    data: messagesPage,
    loading: rawLoading,
    error: primaryError,
    execute: executeRefreshMessages,
  } = useAsyncResource(messagesFetcher, { toastOnError: false });
  const primaryFetchActive =
    streamEnabled && (rawLoading || (messagesPage === null && primaryError === null));
  const { initialLoading, isRefreshing } = loadPhase(
    primaryFetchActive,
    messages.length > 0,
  );

  const {
    loadingMore,
    hasMore,
    loadMoreError,
    loadMoreMessages,
    resetPagingForRefresh,
    applyPrimaryPageMeta,
  } = useMonitorPaging({
    filters,
    primaryFetchActive,
    messagesRef,
    loadMoreRequest,
    fetchPage: fetchMessagesPage,
    setMessages,
    setTotalCount,
  });

  // ─── Wall mode: lightweight total-count fetch (no full message stream) ─────

  useEffect(() => {
    if (streamEnabled || !channelsReady) return;

    let cancelled = false;
    const sseCountAtStart = wallSseCountRef.current;
    setStatsLoading(true);

    void fetchMessagesPage(filters, null)
      .then((page) => {
        if (cancelled) return;
        const requestPeriodSseCount = wallSseCountRef.current - sseCountAtStart;
        setTotalCount((page.totalCount ?? 0) + requestPeriodSseCount);
      })
      .catch((e) => {
        if (cancelled) return;
        captureError(e, { component: "MonitorPage", severity: "error" });
      })
      .finally(() => {
        if (!cancelled) setStatsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [channelsReady, filters, streamEnabled, wallSseCountRef]);

  const refreshMessages = useCallback(
    async (f: MessageFilters) => {
      // Invalidate pending load-more requests so stale pages cannot append to
      // the new query. Rebase the primary page over SSE messages that arrive
      // after this request starts instead of replacing them.
      resetPagingForRefresh();
      const idsAtStart = new Set(messagesRef.current.map((message) => message.id));
      const sseSequenceAtStart = sseSequenceRef.current;
      sseMessagesRef.current.clear();
      const page = await executeRefreshMessages(f);
      if (!page) return null;

      const pageMessages = page.messages ?? [];
      const requestPeriodSse = Array.from(sseMessagesRef.current.values())
        .filter(({ sequence, message }) =>
          sequence > sseSequenceAtStart && matchesFilters(message, f),
        )
        .map(({ message }) => message);

      setMessages((current) => {
        const stateArrivals = current.filter(
          (message) => !idsAtStart.has(message.id) && matchesFilters(message, f),
        );
        const arrivals = mergeUniqueMessages(requestPeriodSse, stateArrivals, "append");
        const rebasedMessages = mergeUniqueMessages(pageMessages, arrivals, "prepend");
        messagesRef.current = rebasedMessages;
        return rebasedMessages;
      });

      const pageIds = new Set(pageMessages.map((message) => message.id));
      const preservedSseCount = requestPeriodSse.filter(
        (message) => !pageIds.has(message.id),
      ).length;
      applyPrimaryPageMeta(page, preservedSseCount);
      return page;
    },
    [
      applyPrimaryPageMeta,
      executeRefreshMessages,
      resetPagingForRefresh,
      sseMessagesRef,
      sseSequenceRef,
    ],
  );

  // NOTE: A periodic 30s blanket refresh was removed here. Live updates are
  // delivered incrementally via SSE (`useMonitorSseMerge`).

  useEffect(() => {
    if (!streamEnabled) return;
    void refreshMessages(filters);
  }, [filters, streamEnabled, refreshMessages]);

  return {
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
  };
}

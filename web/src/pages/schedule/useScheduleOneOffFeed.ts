import { useCallback, useEffect, useRef, useState } from "react";

import {
  listUserEventsPage,
  type UserEvent,
} from "../../api/userEvents";
import { toErrorMessage } from "../../utils/errors";
import { SCHEDULE_PAGE_SIZE } from "./scheduleConfig";

export function useScheduleOneOffFeed(opts: { debouncedSearch: string }) {
  const { debouncedSearch } = opts;
  const [items, setItems] = useState<UserEvent[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const reload = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setInitialLoading(true);
    setError(null);
    try {
      const page = await listUserEventsPage({
        search: debouncedSearch.trim() || undefined,
        limit: SCHEDULE_PAGE_SIZE,
        offset: 0,
      });
      if (requestId !== requestIdRef.current) return;
      setItems(page.items);
      setTotalCount(page.totalCount);
      setHasMore(page.hasMore);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(toErrorMessage(err));
      setItems([]);
      setTotalCount(0);
      setHasMore(false);
    } finally {
      if (requestId === requestIdRef.current) setInitialLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore || initialLoading) return;
    const requestId = requestIdRef.current;
    setLoadingMore(true);
    try {
      const page = await listUserEventsPage({
        search: debouncedSearch.trim() || undefined,
        limit: SCHEDULE_PAGE_SIZE,
        offset: items.length,
      });
      if (requestId !== requestIdRef.current) return;
      setItems((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        const merged = [...prev];
        for (const item of page.items) {
          if (!seen.has(item.id)) merged.push(item);
        }
        return merged;
      });
      setTotalCount(page.totalCount);
      setHasMore(page.hasMore);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setError(toErrorMessage(err));
    } finally {
      if (requestId === requestIdRef.current) setLoadingMore(false);
    }
  }, [debouncedSearch, hasMore, initialLoading, items.length, loadingMore]);

  return {
    items,
    totalCount,
    hasMore,
    initialLoading,
    loadingMore,
    error,
    reload,
    loadMore,
  };
}

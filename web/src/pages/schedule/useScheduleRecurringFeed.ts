import { useCallback, useEffect, useRef, useState } from "react";

import { listRecurringSeries } from "../../api/recurringSeries";
import type { RecurringSeries } from "../../types/recurring";
import { toErrorMessage } from "../../utils/errors";
import { SCHEDULE_PAGE_SIZE } from "./scheduleConfig";

export type ScheduleRecurringItem = RecurringSeries;

export function useScheduleRecurringFeed(opts: {
  debouncedSearch: string;
  worksetId?: string;
  enabled?: boolean;
}) {
  const { debouncedSearch, worksetId, enabled = true } = opts;
  const [items, setItems] = useState<ScheduleRecurringItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const reload = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setError(null);
    if (!enabled) {
      setItems([]);
      setTotalCount(0);
      setHasMore(false);
      setInitialLoading(false);
      return;
    }
    setInitialLoading(true);
    try {
      const page = await listRecurringSeries({
        topLevelOnly: true,
        search: debouncedSearch.trim() || undefined,
        worksetId: worksetId || undefined,
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
  }, [debouncedSearch, enabled, worksetId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const loadMore = useCallback(async () => {
    if (!enabled || !hasMore || loadingMore || initialLoading) return;
    const requestId = requestIdRef.current;
    setLoadingMore(true);
    try {
      const page = await listRecurringSeries({
        topLevelOnly: true,
        search: debouncedSearch.trim() || undefined,
        worksetId: worksetId || undefined,
        limit: SCHEDULE_PAGE_SIZE,
        offset: items.length,
      });
      if (requestId !== requestIdRef.current) return;
      setItems((prev) => {
        const seen = new Set(prev.map((item) => item.id));
        return [...prev, ...page.items.filter((item) => !seen.has(item.id))];
      });
      setTotalCount(page.totalCount);
      setHasMore(page.hasMore);
    } catch (err) {
      if (requestId === requestIdRef.current) setError(toErrorMessage(err));
    } finally {
      if (requestId === requestIdRef.current) setLoadingMore(false);
    }
  }, [debouncedSearch, enabled, hasMore, initialLoading, items.length, loadingMore, worksetId]);

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

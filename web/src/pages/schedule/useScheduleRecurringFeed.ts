import { useCallback, useEffect, useMemo, useState } from "react";

import { listTasks } from "../../api/tasks";
import { fetchTaskSchedule } from "../../api/taskSchedule";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll";
import type { AnalysisTask } from "../../types/tasks";
import { toErrorMessage } from "../../utils/errors";
import { SCHEDULE_PAGE_SIZE } from "./scheduleConfig";

export type ScheduleRecurringItem = AnalysisTask & {
  rrule: string;
};

export function useScheduleRecurringFeed(opts: {
  enabled: boolean;
  debouncedSearch: string;
}) {
  const { enabled, debouncedSearch } = opts;
  const [allItems, setAllItems] = useState<ScheduleRecurringItem[]>([]);
  const [visibleCount, setVisibleCount] = useState(SCHEDULE_PAGE_SIZE);
  const [initialLoading, setInitialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadMoreNode, setLoadMoreNode] = useState<HTMLDivElement | null>(null);

  const reload = useCallback(async () => {
    if (!enabled) return;
    setInitialLoading(true);
    setError(null);
    try {
      const tasks = await listTasks({ analysisMode: "recurring", topLevelOnly: true });
      const schedules = await Promise.all(
        tasks.map(async (task) => {
          try {
            const schedule = await fetchTaskSchedule(task.id);
            return [task.id, schedule.rrule ?? ""] as const;
          } catch {
            return [task.id, ""] as const;
          }
        }),
      );
      const rruleById = new Map(schedules);
      setAllItems(
        tasks.map((task) => ({
          ...task,
          rrule: rruleById.get(task.id) ?? "",
        })),
      );
      setVisibleCount(SCHEDULE_PAGE_SIZE);
    } catch (err) {
      setError(toErrorMessage(err));
      setAllItems([]);
    } finally {
      setInitialLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void reload();
  }, [enabled, reload]);

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter(
      (task) =>
        task.name.toLowerCase().includes(q) ||
        (task.description?.toLowerCase().includes(q) ?? false) ||
        task.rrule.toLowerCase().includes(q) ||
        (task.itemId?.toLowerCase().includes(q) ?? false),
    );
  }, [allItems, debouncedSearch]);

  useEffect(() => {
    setVisibleCount(SCHEDULE_PAGE_SIZE);
  }, [debouncedSearch]);

  const items = useMemo(
    () => filtered.slice(0, visibleCount),
    [filtered, visibleCount],
  );
  const hasMore = visibleCount < filtered.length;
  const totalCount = filtered.length;

  const loadMore = useCallback(() => {
    if (!hasMore) return;
    setVisibleCount((n) => n + SCHEDULE_PAGE_SIZE);
  }, [hasMore]);

  useInfiniteScroll({
    triggerNode: loadMoreNode,
    onLoadMore: loadMore,
    disabled: !enabled || initialLoading || !hasMore,
    root: null,
    rootMargin: "0px 0px 240px 0px",
  });

  return {
    items,
    totalCount,
    hasMore,
    initialLoading,
    loadingMore: false,
    error,
    reload,
    loadMore,
    setLoadMoreTriggerRef: setLoadMoreNode,
  };
}

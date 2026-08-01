import { useCallback, useEffect, useRef, useState } from "react";

import { toErrorMessage } from "../utils/errors";
import { useAsyncResource } from "./useAsyncResource";

export interface PagedResourcePage<TItem> {
  items: TItem[];
  hasMore: boolean;
}

export interface UsePagedAsyncResourceOptions<TItem> {
  /** Forwarded to the first-page `useAsyncResource`. Default false. */
  toastOnError?: boolean;
  /** Merge append into the cached list. Defaults to concatenate. */
  mergePages?: (existing: TItem[], incoming: TItem[]) => TItem[];
}

export interface UsePagedAsyncResourceResult<TArgs, TItem> {
  items: TItem[];
  hasMore: boolean;
  initialLoading: boolean;
  isRefreshing: boolean;
  loadingMore: boolean;
  /** First-page fetch error, or the latest append error. */
  error: string | null;
  /** Load / reload page 0 for the given args (stale-safe). */
  loadFirst: (args: TArgs) => Promise<PagedResourcePage<TItem> | null>;
  /** Append the next page using the last `loadFirst` args + current length. */
  append: () => Promise<PagedResourcePage<TItem> | null>;
  reset: () => void;
}

function defaultMerge<TItem>(existing: TItem[], incoming: TItem[]): TItem[] {
  if (incoming.length === 0) return existing;
  return [...existing, ...incoming];
}

/**
 * Shared first-page + append pagination primitive with stale-request guarding
 * on the primary fetch and a serialized append queue.
 *
 * Designed for offset-style feeds (intelligence). Cursor + SSE streams
 * (monitor) stay on their dedicated hooks.
 */
export function usePagedAsyncResource<TArgs, TItem>(
  fetchPage: (args: TArgs, offset: number) => Promise<PagedResourcePage<TItem>>,
  options?: UsePagedAsyncResourceOptions<TItem>,
): UsePagedAsyncResourceResult<TArgs, TItem> {
  const mergePages = options?.mergePages ?? defaultMerge<TItem>;
  const [items, setItems] = useState<TItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [appendError, setAppendError] = useState<string | null>(null);

  const itemsRef = useRef(items);
  const hasMoreRef = useRef(hasMore);
  const argsRef = useRef<TArgs | null>(null);
  const queueRef = useRef<Promise<PagedResourcePage<TItem> | null> | null>(null);
  const fetchPageRef = useRef(fetchPage);
  const mergePagesRef = useRef(mergePages);
  itemsRef.current = items;
  hasMoreRef.current = hasMore;
  fetchPageRef.current = fetchPage;
  mergePagesRef.current = mergePages;

  const firstPageFetcher = useCallback(
    (args: TArgs) => fetchPageRef.current(args, 0),
    [],
  );

  const {
    data: firstPage,
    initialLoading,
    isRefreshing,
    error: fetchError,
    execute: executeFirst,
    reset: resetFirst,
  } = useAsyncResource(firstPageFetcher, { toastOnError: options?.toastOnError });

  useEffect(() => {
    if (!firstPage) return;
    const next = firstPage.items ?? [];
    setItems(next);
    itemsRef.current = next;
    const more = firstPage.hasMore ?? false;
    setHasMore(more);
    hasMoreRef.current = more;
    setAppendError(null);
  }, [firstPage]);

  const loadFirst = useCallback(
    async (args: TArgs) => {
      argsRef.current = args;
      setAppendError(null);
      return executeFirst(args);
    },
    [executeFirst],
  );

  const append = useCallback(async () => {
    const args = argsRef.current;
    if (args === null || !hasMoreRef.current) return null;

    const inFlight = queueRef.current;
    if (inFlight) {
      await inFlight;
    }
    if (!hasMoreRef.current) return null;

    setLoadingMore(true);
    setAppendError(null);

    const task = (async (): Promise<PagedResourcePage<TItem> | null> => {
      try {
        const page = await fetchPageRef.current(args, itemsRef.current.length);
        const incoming = page.items ?? [];
        const merged = mergePagesRef.current(itemsRef.current, incoming);
        itemsRef.current = merged;
        setItems(merged);
        const more = page.hasMore ?? false;
        setHasMore(more);
        hasMoreRef.current = more;
        return page;
      } catch (error: unknown) {
        setAppendError(toErrorMessage(error));
        throw error;
      }
    })();

    queueRef.current = task;
    try {
      return await task;
    } finally {
      if (queueRef.current === task) {
        queueRef.current = null;
      }
      setLoadingMore(false);
    }
  }, []);

  const reset = useCallback(() => {
    argsRef.current = null;
    resetFirst();
    setItems([]);
    itemsRef.current = [];
    setHasMore(false);
    hasMoreRef.current = false;
    setLoadingMore(false);
    setAppendError(null);
  }, [resetFirst]);

  return {
    items,
    hasMore,
    initialLoading,
    isRefreshing,
    loadingMore,
    error: appendError ?? fetchError,
    loadFirst,
    append,
    reset,
  };
}

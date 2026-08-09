import { useCallback, useEffect, useState } from "react";

import { useAsyncResource } from "../../../hooks/useAsyncResource";
import { useRemoveItem } from "./useRemoveItem";

interface UseSourceListTabOptions<T> {
  /** Fetches the tab's item list. Must be referentially stable (e.g. a module-level API function). */
  listFn: () => Promise<T[]>;
  /** Removes one item (e.g. deletes its source). */
  removeFn: (target: T) => Promise<void>;
}

const EMPTY_ITEMS: never[] = [];

/**
 * Shared list-tab state for source management tabs (RSS / Discord / MQTT / Email):
 * initial load, load error + manual retry, and the remove-confirmation dialog.
 * Tab-specific add-form state stays in the individual tab hooks.
 */
export function useSourceListTab<T>({ listFn, removeFn }: UseSourceListTabOptions<T>) {
  const [retrying, setRetrying] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetcher = useCallback(() => listFn(), [listFn]);
  const {
    data,
    initialLoading,
    isRefreshing,
    error: fetchError,
    execute,
  } = useAsyncResource(fetcher);

  const items = data ?? EMPTY_ITEMS;
  const error = actionError ?? fetchError;

  const fetchItems = useCallback(async () => {
    setActionError(null);
    try {
      await execute(undefined);
    } finally {
      setRetrying(false);
    }
  }, [execute]);

  const { removeTarget, setRemoveTarget, removing, confirmRemove } = useRemoveItem<T>({
    removeFn,
    onRemoved: fetchItems,
    onError: setActionError,
  });

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const handleRetry = useCallback(() => {
    setRetrying(true);
    void fetchItems();
  }, [fetchItems]);

  return {
    items,
    initialLoading,
    isRefreshing,
    error,
    retrying,
    fetchItems,
    handleRetry,
    removeTarget,
    setRemoveTarget,
    removing,
    confirmRemove,
  };
}

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  listItemCategories,
  listItems,
  type ItemCategory,
  type TrackableItem,
} from "../../api/items";
import { listWorksets, type Workset } from "../../api/worksets";
import { useOptionalTaskCatalog } from "../../context/TaskCatalogContext";
import { formatItemsError } from "../../domain/items/itemErrors";
import { subscribeResourceModified } from "../../domain/sse/resourceModified";
import type { ItemsListFetchParams } from "../../domain/items/itemsListModel";

export type ItemsReloadOptions = { background?: boolean };

type UseItemsDataOptions = {
  /** When set, item rows use filtered ``listItems`` (entry list). Hub omits this. */
  listFetch?: ItemsListFetchParams | null;
};

/**
 * Shared items / categories / worksets load path for ItemsPage.
 * `reload()` is safe for promise `.then(reload)` (ignores fulfillment value).
 */
export function useItemsData(options?: UseItemsDataOptions) {
  const listFetch = options?.listFetch ?? null;
  const { t } = useTranslation("items");
  const catalog = useOptionalTaskCatalog();
  const catalogMounted = catalog != null;
  const [items, setItems] = useState<TrackableItem[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [fallbackWorksets, setFallbackWorksets] = useState<Workset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const worksets = catalogMounted ? catalog.worksets : fallbackWorksets;

  const reload = useCallback(async (opts?: ItemsReloadOptions) => {
    if (!opts?.background) setLoading(true);
    setError(null);
    try {
      const itemParams = listFetch ?? undefined;
      if (catalogMounted) {
        const [itemRows, categoryRows] = await Promise.all([
          listItems(itemParams),
          listItemCategories(),
        ]);
        setItems(itemRows);
        setCategories(categoryRows);
      } else {
        const [itemRows, categoryRows, worksetRows] = await Promise.all([
          listItems(itemParams),
          listItemCategories(),
          listWorksets(),
        ]);
        setItems(itemRows);
        setCategories(categoryRows);
        setFallbackWorksets(worksetRows);
      }
    } catch (err) {
      setError(formatItemsError(err, t));
    } finally {
      if (!opts?.background) setLoading(false);
    }
  }, [t, listFetch, catalogMounted]);

  /** Parameterless refresh for `.then(refresh)` / `onChanged={refresh}`. */
  const refresh = useCallback(() => reload(), [reload]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    return subscribeResourceModified((detail) => {
      if (detail.resourceType !== "item" && detail.resourceType !== "item_category") {
        return;
      }
      void reload({ background: true });
    });
  }, [reload]);

  return {
    items,
    categories,
    worksets,
    loading,
    error,
    reload,
    refresh,
  };
}

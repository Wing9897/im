import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  listItemCategories,
  listItems,
  type ItemCategory,
  type TrackableItem,
} from "../../api/items";
import { listWorksets } from "../../api/worksets";
import type { Workset } from "../../types/worksets";
import { formatItemsError } from "../../domain/items/itemErrors";
import { subscribeResourceModified } from "../../domain/sse/resourceModified";

export type ItemsReloadOptions = { background?: boolean };

/**
 * Shared items / categories / worksets load path for ItemsPage.
 * `reload()` is safe for promise `.then(reload)` (ignores fulfillment value).
 */
export function useItemsData() {
  const { t } = useTranslation("items");
  const [items, setItems] = useState<TrackableItem[]>([]);
  const [categories, setCategories] = useState<ItemCategory[]>([]);
  const [worksets, setWorksets] = useState<Workset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (opts?: ItemsReloadOptions) => {
    if (!opts?.background) setLoading(true);
    setError(null);
    try {
      const [itemRows, categoryRows, worksetRows] = await Promise.all([
        listItems(),
        listItemCategories(),
        listWorksets(),
      ]);
      setItems(itemRows);
      setCategories(categoryRows);
      setWorksets(worksetRows);
    } catch (err) {
      setError(formatItemsError(err, t));
    } finally {
      if (!opts?.background) setLoading(false);
    }
  }, [t]);

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

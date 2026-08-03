import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import type { TrackableItem } from "../../api/items";
import { UNCATEGORIZED_CATEGORY_ID } from "../../domain/items/categoryAggregates";

type UseItemsDeepLinksArgs = {
  loading: boolean;
  items: readonly TrackableItem[];
  listLayer: boolean;
  setEditing: Dispatch<SetStateAction<TrackableItem | null | "new">>;
  setCreateWorksetId: Dispatch<SetStateAction<string | null>>;
};

/**
 * ItemsPage URL deep-links:
 * - `?category=` → category list route
 * - `?itemId=` → open item editor (optionally via category first)
 * - `?new=1&worksetId=` → open create dialog
 */
export function useItemsDeepLinks({
  loading,
  items,
  listLayer,
  setEditing,
  setCreateWorksetId,
}: UseItemsDeepLinksArgs) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkHandled = useRef<string | null>(null);
  const createLinkHandled = useRef(false);

  // Support /items?category=… → list layer
  useEffect(() => {
    // listLayer implies a routeCategoryId already; skip query rewrite when nested.
    if (listLayer) return;
    const q = searchParams.get("category")?.trim();
    if (!q) return;
    const next = new URLSearchParams(searchParams);
    next.delete("category");
    const qs = next.toString();
    navigate(`/items/category/${encodeURIComponent(q)}${qs ? `?${qs}` : ""}`, {
      replace: true,
    });
  }, [listLayer, searchParams, navigate]);

  // Deep-link from Timeline: /items?itemId=…&itemDateKind=purchased|expires|remind
  useEffect(() => {
    if (loading) return;
    const itemId = searchParams.get("itemId")?.trim();
    if (!itemId) {
      deepLinkHandled.current = null;
      return;
    }
    if (deepLinkHandled.current === itemId) return;
    const match = items.find((row) => row.id === itemId);
    if (!match) return;
    deepLinkHandled.current = itemId;
    // If on type layer, jump into the item's category list first.
    if (!listLayer) {
      const catId = match.categoryId ?? UNCATEGORIZED_CATEGORY_ID;
      const next = new URLSearchParams(searchParams);
      navigate(`/items/category/${encodeURIComponent(catId)}?${next.toString()}`, {
        replace: true,
      });
      return;
    }
    setEditing(match);
    const next = new URLSearchParams(searchParams);
    next.delete("itemId");
    next.delete("itemDateKind");
    setSearchParams(next, { replace: true });
  }, [loading, items, searchParams, setSearchParams, listLayer, navigate, setEditing]);

  // Deep-link from workset detail: /items?new=1&worksetId=…
  useEffect(() => {
    if (loading) return;
    const wantsNew = searchParams.get("new") === "1";
    if (!wantsNew) {
      createLinkHandled.current = false;
      return;
    }
    if (createLinkHandled.current) return;
    createLinkHandled.current = true;
    const wid = searchParams.get("worksetId")?.trim() || null;
    setCreateWorksetId(wid);
    setEditing("new");
    const next = new URLSearchParams(searchParams);
    next.delete("new");
    next.delete("worksetId");
    setSearchParams(next, { replace: true });
  }, [loading, searchParams, setSearchParams, setCreateWorksetId, setEditing]);
}

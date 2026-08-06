import { useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import type { TrackableItem } from "../../api/items";
import { UNCATEGORIZED_CATEGORY_ID } from "../../domain/items/categoryAggregates";
import { buildItemsEditPath, buildItemsNewPath } from "./itemsNavigation";

type UseItemsDeepLinksArgs = {
  loading: boolean;
  items: readonly TrackableItem[];
  listLayer: boolean;
};

/**
 * ItemsPage URL deep-links (legacy query params → route pages):
 * - `?category=` → category list route
 * - `?itemId=` → `/items/:id/edit` (legacy `itemDateKind` ignored / stripped)
 * - `?new=1&worksetId=` → `/items/new?worksetId=`
 */
export function useItemsDeepLinks({ loading, items, listLayer }: UseItemsDeepLinksArgs) {
  const navigate = useNavigate();
  const { categoryId: routeCategoryId } = useParams<{ categoryId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkHandled = useRef<string | null>(null);
  const createLinkHandled = useRef(false);

  useEffect(() => {
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
    if (!listLayer) {
      const catId = match.categoryId ?? UNCATEGORIZED_CATEGORY_ID;
      const next = new URLSearchParams(searchParams);
      // Legacy Timeline bookmarks may still carry itemDateKind; drop it early.
      next.delete("itemDateKind");
      navigate(`/items/category/${encodeURIComponent(catId)}?${next.toString()}`, {
        replace: true,
      });
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.delete("itemId");
    next.delete("itemDateKind");
    setSearchParams(next, { replace: true });
    navigate(
      buildItemsEditPath(itemId, {
        categoryId: routeCategoryId ?? match.categoryId ?? UNCATEGORIZED_CATEGORY_ID,
      }),
      { replace: true },
    );
  }, [loading, items, searchParams, setSearchParams, listLayer, navigate, routeCategoryId]);

  useEffect(() => {
    if (loading) return;
    const wantsNew = searchParams.get("new") === "1";
    if (!wantsNew) {
      createLinkHandled.current = false;
      return;
    }
    if (createLinkHandled.current) return;
    createLinkHandled.current = true;
    const wid = searchParams.get("worksetId")?.trim();
    const cat =
      searchParams.get("categoryId")?.trim() ||
      (listLayer ? routeCategoryId?.trim() : null) ||
      null;
    setSearchParams(new URLSearchParams(), { replace: true });
    navigate(buildItemsNewPath({ categoryId: cat, worksetId: wid }), { replace: true });
  }, [loading, searchParams, setSearchParams, navigate, listLayer, routeCategoryId]);
}

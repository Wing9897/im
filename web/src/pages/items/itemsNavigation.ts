/**
 * Items form ↔ list-layer navigation helpers.
 *
 * List layers live at `/items/category/:categoryId` (real id, `all`, or `uncategorized`).
 * Form routes carry `?categoryId=` as the **origin list layer** to return to (also
 * prefills create when the id is a real category).
 */

import {
  ALL_CATEGORIES_ID,
  UNCATEGORIZED_CATEGORY_ID,
  isSyntheticCategoryId,
} from "../../domain/items/categoryAggregates";

export type ItemsFormQueryOpts = {
  /** List-layer category route id the user came from (or create prefill). */
  categoryId?: string | null;
  /** Prefill / preserve workset when present on create deep-links. */
  worksetId?: string | null;
};

function appendFormQuery(params: URLSearchParams, opts?: ItemsFormQueryOpts): void {
  const cat = opts?.categoryId?.trim() || null;
  if (cat) params.set("categoryId", cat);
  const wid = opts?.worksetId?.trim() || null;
  if (wid) params.set("worksetId", wid);
}

/** Build `/items/new` with optional origin category + workset prefill. */
export function buildItemsNewPath(opts?: ItemsFormQueryOpts): string {
  const params = new URLSearchParams();
  appendFormQuery(params, opts);
  const qs = params.toString();
  return qs ? `/items/new?${qs}` : "/items/new";
}

/** Build `/items/:id/edit` with optional origin list-layer category. */
export function buildItemsEditPath(itemId: string, opts?: ItemsFormQueryOpts): string {
  const params = new URLSearchParams();
  appendFormQuery(params, opts);
  const qs = params.toString();
  const base = `/items/${encodeURIComponent(itemId)}/edit`;
  return qs ? `${base}?${qs}` : base;
}

/**
 * Where the item form Back / post-save should land.
 *
 * Priority:
 * 1. Explicit `categoryId` query (list layer user came from, including `all` / `uncategorized`)
 * 2. Item's own category (deep link / refresh with no history)
 * 3. Uncategorized list when a loaded edit item has no category
 * 4. Items root overview
 */
export function resolveItemFormBackPath(args: {
  categoryIdParam?: string | null;
  itemCategoryId?: string | null;
  /**
   * True when the edit target has been loaded (so a null categoryId means
   * uncategorized). Must stay false for create mode.
   */
  itemKnown?: boolean;
}): string {
  const fromQuery = args.categoryIdParam?.trim() || null;
  if (fromQuery) {
    return `/items/category/${encodeURIComponent(fromQuery)}`;
  }
  const fromItem = args.itemCategoryId?.trim() || null;
  if (fromItem && !isSyntheticCategoryId(fromItem)) {
    return `/items/category/${encodeURIComponent(fromItem)}`;
  }
  if (args.itemKnown && !fromItem) {
    return `/items/category/${encodeURIComponent(UNCATEGORIZED_CATEGORY_ID)}`;
  }
  return "/items";
}

/**
 * Map a list-layer route id + query into create-form initial categoryId.
 * Synthetic `all` / `uncategorized` mean "no category selected".
 */
export function resolveCreateInitialCategoryId(
  categoryIdParam: string | null | undefined,
): string | null {
  const raw = categoryIdParam?.trim() || null;
  if (!raw || isSyntheticCategoryId(raw)) return null;
  return raw;
}

export { ALL_CATEGORIES_ID, UNCATEGORIZED_CATEGORY_ID };

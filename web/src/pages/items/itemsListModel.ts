import type { TrackableItem, ItemStatus } from "../../api/items";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import {
  ALL_CATEGORIES_ID,
  isItemExpiringSoon,
  UNCATEGORIZED_CATEGORY_ID,
} from "../../domain/items/categoryAggregates";
import { daysUntil } from "../../domain/items/itemAttributes";

export type ItemsFilterKey = "all" | "expiring" | "overdue" | "archived";

/** Entry-list sort — applied within each workset group. */
export type ItemsSortKey = "expiry" | "name" | "updated";

export const ITEMS_SORT_OPTION_KEYS: ReadonlyArray<[ItemsSortKey, string]> = [
  ["expiry", "sortExpiry"],
  ["name", "sortName"],
  ["updated", "sortUpdated"],
];

export type ItemsWorksetGroup = {
  worksetId: string;
  rows: TrackableItem[];
};

/** Lowercased haystack for title / notes / emoji / attributes / inventory fields. */
export function itemSearchHaystack(item: TrackableItem): string {
  const attrs = item.attributes ?? {};
  const attrParts: string[] = [];
  for (const [key, value] of Object.entries(attrs)) {
    if (key) attrParts.push(key);
    if (value) attrParts.push(String(value));
  }
  const inventoryParts: string[] = [];
  if (item.unit) inventoryParts.push(item.unit);
  if (item.quantity != null) inventoryParts.push(String(item.quantity));
  if (item.price != null) inventoryParts.push(String(item.price));
  return [item.title, item.notes, item.emoji ?? "", ...inventoryParts, ...attrParts]
    .join(" ")
    .toLowerCase();
}

export type ItemsListFetchParams = {
  categoryId?: string;
  status?: ItemStatus;
  search?: string;
  worksetId?: string;
};

/** Map entry-list UI state to ``listItems`` query params (entry layer only). */
export function buildItemsListFetchParams(args: {
  categoryRouteId: string | null;
  filter: ItemsFilterKey;
  search: string;
  worksetFilterId: string | null;
}): ItemsListFetchParams {
  const params: ItemsListFetchParams = {};
  if (args.categoryRouteId && args.categoryRouteId !== ALL_CATEGORIES_ID) {
    params.categoryId =
      args.categoryRouteId === UNCATEGORIZED_CATEGORY_ID ? "" : args.categoryRouteId;
  }
  params.status = args.filter === "archived" ? "archived" : "active";
  const needle = args.search.trim();
  if (needle) params.search = needle;
  if (args.worksetFilterId) params.worksetId = args.worksetFilterId;
  return params;
}

/** Apply status / expiring / overdue / text search filters to a scoped item list. */
export function filterItemsList(
  scopedItems: readonly TrackableItem[],
  filter: ItemsFilterKey,
  search: string,
): TrackableItem[] {
  const needle = search.trim().toLowerCase();
  return scopedItems.filter((item) => {
    if (filter === "archived") {
      if (item.status !== "archived") return false;
    } else if (item.status === "archived") {
      return false;
    }
    if (filter === "overdue") {
      const days = daysUntil(item.expiresAt);
      if (days == null || days >= 0) return false;
    }
    if (filter === "expiring") {
      if (!isItemExpiringSoon(item)) return false;
    }
    if (!needle) return true;
    return itemSearchHaystack(item).includes(needle);
  });
}

function compareItems(a: TrackableItem, b: TrackableItem, sort: ItemsSortKey): number {
  if (sort === "name") {
    const byTitle = a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
    if (byTitle !== 0) return byTitle;
    return a.id.localeCompare(b.id);
  }
  if (sort === "updated") {
    const ua = a.updatedAt ?? a.createdAt ?? "";
    const ub = b.updatedAt ?? b.createdAt ?? "";
    if (ua !== ub) return ub.localeCompare(ua);
    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  }
  // expiry (default): category then expiresAt (nulls last)
  const ca = a.categoryId ?? "";
  const cb = b.categoryId ?? "";
  if (ca !== cb) return ca.localeCompare(cb);
  const ea = a.expiresAt ?? "\uffff";
  const eb = b.expiresAt ?? "\uffff";
  if (ea !== eb) return ea.localeCompare(eb);
  return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
}

/** Flat sorted list (no workset sections) — default entry-list layout. */
export function sortItemsList(
  filtered: readonly TrackableItem[],
  sort: ItemsSortKey = "expiry",
): TrackableItem[] {
  return filtered.slice().sort((a, b) => compareItems(a, b, sort));
}

/**
 * Build an id → row lookup for catalog lists (categories / worksets).
 * Skips nullish rows and non-string ids so `new Map(...)` never receives bare values.
 */
export function indexById<T extends { id?: unknown }>(
  rows: readonly T[] | null | undefined,
): Map<string, T> {
  const map = new Map<string, T>();
  if (!Array.isArray(rows)) return map;
  for (const row of rows) {
    if (!row || typeof row.id !== "string" || !row.id) continue;
    map.set(row.id, row);
  }
  return map;
}

/** Group filtered items by workset, preserving catalog order then leftovers. */
export function groupItemsByWorkset(
  filtered: readonly TrackableItem[],
  worksetIds: readonly string[],
  sort: ItemsSortKey = "expiry",
): ItemsWorksetGroup[] {
  const byWorkset = new Map<string, TrackableItem[]>();
  for (const item of filtered) {
    const wid = item.worksetId || SYSTEM_WORKSET_ID;
    const list = byWorkset.get(wid) ?? [];
    list.push(item);
    byWorkset.set(wid, list);
  }
  const ids = [
    ...worksetIds.filter((id) => byWorkset.has(id)),
    ...[...byWorkset.keys()].filter((id) => !worksetIds.includes(id)),
  ];
  return ids.map((worksetId) => {
    const rows = (byWorkset.get(worksetId) ?? [])
      .slice()
      .sort((a, b) => compareItems(a, b, sort));
    return { worksetId, rows };
  });
}

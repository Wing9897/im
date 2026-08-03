import type { TrackableItem } from "../../api/items";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { isItemExpiringSoon } from "../../domain/items/categoryAggregates";
import { daysUntil } from "../../domain/items/itemAttributes";

export type ItemsFilterKey = "all" | "expiring" | "overdue" | "archived";

export type ItemsWorksetGroup = {
  worksetId: string;
  rows: TrackableItem[];
};

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
    const hay = `${item.title} ${item.notes} ${JSON.stringify(item.attributes)}`.toLowerCase();
    return hay.includes(needle);
  });
}

/** Group filtered items by workset, preserving catalog order then leftovers. */
export function groupItemsByWorkset(
  filtered: readonly TrackableItem[],
  worksetIds: readonly string[],
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
    const rows = (byWorkset.get(worksetId) ?? []).slice().sort((a, b) => {
      const ca = a.categoryId ?? "";
      const cb = b.categoryId ?? "";
      if (ca !== cb) return ca.localeCompare(cb);
      return (a.expiresAt ?? "").localeCompare(b.expiresAt ?? "");
    });
    return { worksetId, rows };
  });
}

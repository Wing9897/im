/**
 * Category-layer aggregates for the /items two-layer UI.
 * Counts are derived from list payloads (no stamp bump).
 */

import type { ItemCategory, TrackableItem } from "../../api/items";
import { daysUntil, expiryTone } from "./itemExpiryTone";

/** URL / route sentinel for items with null category_id. */
export const UNCATEGORIZED_CATEGORY_ID = "uncategorized";

/** URL / route sentinel for the cross-category list. */
export const ALL_CATEGORIES_ID = "all";

export type CategorySummary = {
  id: string;
  /** Null for the synthetic uncategorized / all cards. */
  category: ItemCategory | null;
  itemCount: number;
  expiringCount: number;
  overdueCount: number;
};

export function isSyntheticCategoryId(id: string): boolean {
  return id === UNCATEGORIZED_CATEGORY_ID || id === ALL_CATEGORIES_ID;
}

export function resolveCategoryRouteId(categoryId: string | null | undefined): string {
  if (!categoryId) return UNCATEGORIZED_CATEGORY_ID;
  return categoryId;
}

/** Whether an active item is inside its remind window (matches list filter / expiryTone). */
export function isItemExpiringSoon(item: TrackableItem): boolean {
  if (item.status === "archived") return false;
  return expiryTone(daysUntil(item.expiresAt), item.remindBeforeDays) === "soon";
}

export function isItemOverdue(item: TrackableItem): boolean {
  if (item.status === "archived") return false;
  return expiryTone(daysUntil(item.expiresAt), item.remindBeforeDays) === "overdue";
}

/**
 * Build category cards: each real category (even if empty) + uncategorized when needed.
 * Active (non-archived) items drive counts; archived-only categories still appear with 0.
 */
export function buildCategorySummaries(
  categories: readonly ItemCategory[],
  items: readonly TrackableItem[],
): CategorySummary[] {
  const active = items.filter((item) => item.status !== "archived");
  const byCategory = new Map<string | null, TrackableItem[]>();
  for (const item of active) {
    const key = item.categoryId ?? null;
    const list = byCategory.get(key) ?? [];
    list.push(item);
    byCategory.set(key, list);
  }

  const summaries: CategorySummary[] = categories
    .slice()
    .sort((a, b) => {
      const so = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      if (so !== 0) return so;
      return a.name.localeCompare(b.name);
    })
    .map((category) => {
      const rows = byCategory.get(category.id) ?? [];
      return {
        id: category.id,
        category,
        itemCount: rows.length,
        expiringCount: rows.filter(isItemExpiringSoon).length,
        overdueCount: rows.filter(isItemOverdue).length,
      };
    });

  const uncategorized = byCategory.get(null) ?? [];
  summaries.push({
    id: UNCATEGORIZED_CATEGORY_ID,
    category: null,
    itemCount: uncategorized.length,
    expiringCount: uncategorized.filter(isItemExpiringSoon).length,
    overdueCount: uncategorized.filter(isItemOverdue).length,
  });

  return summaries;
}

function compareCategorySummaries(
  a: CategorySummary,
  b: CategorySummary,
  sort: "expiry" | "name" | "updated",
  labelOf: (summary: CategorySummary) => string,
): number {
  if (sort === "name") {
    const byLabel = labelOf(a).localeCompare(labelOf(b), undefined, { sensitivity: "base" });
    if (byLabel !== 0) return byLabel;
    return a.id.localeCompare(b.id);
  }
  if (sort === "updated") {
    const ua = a.category?.updatedAt ?? a.category?.createdAt ?? "";
    const ub = b.category?.updatedAt ?? b.category?.createdAt ?? "";
    if (ua !== ub) return ub.localeCompare(ua);
    return labelOf(a).localeCompare(labelOf(b), undefined, { sensitivity: "base" });
  }
  // expiry: urgency counts first, then admin sort order, then name
  if (a.overdueCount !== b.overdueCount) return b.overdueCount - a.overdueCount;
  if (a.expiringCount !== b.expiringCount) return b.expiringCount - a.expiringCount;
  const so =
    (a.category?.sortOrder ?? 0) - (b.category?.sortOrder ?? 0);
  if (so !== 0) return so;
  return labelOf(a).localeCompare(labelOf(b), undefined, { sensitivity: "base" });
}

/** Sort category cards; uncategorized stays last. */
export function sortCategorySummaries(
  summaries: readonly CategorySummary[],
  sort: "expiry" | "name" | "updated",
  labelOf: (summary: CategorySummary) => string,
): CategorySummary[] {
  const uncategorized = summaries.find((row) => row.id === UNCATEGORIZED_CATEGORY_ID);
  const real = summaries.filter((row) => row.id !== UNCATEGORIZED_CATEGORY_ID);
  const sorted = real.slice().sort((a, b) => compareCategorySummaries(a, b, sort, labelOf));
  if (uncategorized) sorted.push(uncategorized);
  return sorted;
}

/** Filter items for the list layer given a route category id. */
export function filterItemsByCategoryRoute(
  items: readonly TrackableItem[],
  categoryRouteId: string | null,
): TrackableItem[] {
  if (!categoryRouteId || categoryRouteId === ALL_CATEGORIES_ID) {
    return [...items];
  }
  if (categoryRouteId === UNCATEGORIZED_CATEGORY_ID) {
    return items.filter((item) => !item.categoryId);
  }
  return items.filter((item) => item.categoryId === categoryRouteId);
}

export function categoryLabel(
  category: ItemCategory | null | undefined,
  t: (key: string, opts?: Record<string, unknown>) => string,
): string {
  if (!category) return t("noCategory");
  if (category.slug) {
    const key = `seed.${category.slug}`;
    const translated = t(key);
    if (translated !== key) return translated;
  }
  return category.name;
}

/** Preset swatches for category color editing (hex, matches seed palette). */
export const CATEGORY_COLOR_PRESETS = [
  "#3B82F6",
  "#22C55E",
  "#F59E0B",
  "#8B5CF6",
  "#EC4899",
  "#64748B",
  "#EF4444",
  "#14B8A6",
] as const;

import { describe, expect, it } from "vitest";
import type { ItemCategory, TrackableItem } from "../../api/items";
import {
  ALL_CATEGORIES_ID,
  UNCATEGORIZED_CATEGORY_ID,
  buildCategorySummaries,
  sortCategorySummaries,
  categoryLabel,
  filterItemsByCategoryRoute,
  isItemExpiringSoon,
  isItemOverdue,
  resolveCategoryRouteId,
} from "./categoryAggregates";

function cat(partial: Partial<ItemCategory> & { id: string; name: string }): ItemCategory {
  return {
    sortOrder: 0,
    defaultRemindBeforeDays: 7,
    color: null,
    slug: null,
    createdAt: null,
    updatedAt: null,
    ...partial,
  };
}

function item(
  partial: Partial<TrackableItem> & { id: string; title: string },
): TrackableItem {
  return {
    worksetId: "__general__",
    categoryId: null,
    expiresAt: null,
    remindBeforeDays: 7,
    notes: "",
    status: "active",
    createdAt: null,
    updatedAt: null,
    ...partial,
  };
}

describe("resolveCategoryRouteId", () => {
  it("maps null to uncategorized sentinel", () => {
    expect(resolveCategoryRouteId(null)).toBe(UNCATEGORIZED_CATEGORY_ID);
    expect(resolveCategoryRouteId(undefined)).toBe(UNCATEGORIZED_CATEGORY_ID);
    expect(resolveCategoryRouteId("seed_food")).toBe("seed_food");
  });
});

function isoDaysFromNow(delta: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + delta);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

describe("buildCategorySummaries", () => {
  it("includes empty categories and uncategorized counts", () => {
    const categories = [
      cat({ id: "c1", name: "Food", sortOrder: 20, slug: "food" }),
      cat({ id: "c2", name: "Docs", sortOrder: 10, slug: "passport_docs" }),
    ];
    const items = [
      item({ id: "i1", title: "Milk", categoryId: "c1", expiresAt: isoDaysFromNow(2) }),
      item({ id: "i2", title: "Old", categoryId: "c1", expiresAt: isoDaysFromNow(-10) }),
      item({ id: "i3", title: "Loose", categoryId: null }),
      item({
        id: "i4",
        title: "Archived",
        categoryId: "c1",
        status: "archived",
        expiresAt: isoDaysFromNow(1),
      }),
    ];
    const summaries = buildCategorySummaries(categories, items);
    expect(summaries.map((s) => s.id)).toEqual(["c2", "c1", UNCATEGORIZED_CATEGORY_ID]);
    const food = summaries.find((s) => s.id === "c1")!;
    expect(food.itemCount).toBe(2);
    expect(food.expiringCount).toBe(1);
    expect(food.overdueCount).toBe(1);
    const docs = summaries.find((s) => s.id === "c2")!;
    expect(docs.itemCount).toBe(0);
    const unc = summaries.find((s) => s.id === UNCATEGORIZED_CATEGORY_ID)!;
    expect(unc.itemCount).toBe(1);
  });
});

describe("sortCategorySummaries", () => {
  it("sorts by urgency for expiry and keeps uncategorized last", () => {
    const categories = [
      cat({ id: "c1", name: "Food", sortOrder: 20, slug: "food" }),
      cat({ id: "c2", name: "Docs", sortOrder: 10, slug: "passport_docs" }),
    ];
    const items = [
      item({ id: "i1", title: "Milk", categoryId: "c1", expiresAt: isoDaysFromNow(2) }),
      item({ id: "i2", title: "Old", categoryId: "c1", expiresAt: isoDaysFromNow(-10) }),
      item({ id: "i3", title: "Loose", categoryId: null }),
    ];
    const summaries = buildCategorySummaries(categories, items);
    const label = (summary: (typeof summaries)[number]) =>
      summary.category?.name ?? "uncategorized";

    expect(sortCategorySummaries(summaries, "expiry", label).map((s) => s.id)).toEqual([
      "c1",
      "c2",
      UNCATEGORIZED_CATEGORY_ID,
    ]);
    expect(sortCategorySummaries(summaries, "name", label).map((s) => s.id)).toEqual([
      "c2",
      "c1",
      UNCATEGORIZED_CATEGORY_ID,
    ]);
  });
});

describe("filterItemsByCategoryRoute", () => {
  const items = [
    item({ id: "a", title: "A", categoryId: "c1" }),
    item({ id: "b", title: "B", categoryId: null }),
    item({ id: "c", title: "C", categoryId: "c2" }),
  ];

  it("returns all for all / null", () => {
    expect(filterItemsByCategoryRoute(items, ALL_CATEGORIES_ID)).toHaveLength(3);
    expect(filterItemsByCategoryRoute(items, null)).toHaveLength(3);
  });

  it("filters uncategorized and by id", () => {
    expect(filterItemsByCategoryRoute(items, UNCATEGORIZED_CATEGORY_ID).map((i) => i.id)).toEqual([
      "b",
    ]);
    expect(filterItemsByCategoryRoute(items, "c1").map((i) => i.id)).toEqual(["a"]);
  });
});

describe("isItemExpiringSoon / isItemOverdue", () => {
  it("respects remind window and archive", () => {
    expect(
      isItemExpiringSoon(
        item({
          id: "1",
          title: "x",
          expiresAt: isoDaysFromNow(3),
          remindBeforeDays: 7,
        }),
      ),
    ).toBe(true);
    expect(
      isItemOverdue(item({ id: "2", title: "x", expiresAt: isoDaysFromNow(-1) })),
    ).toBe(true);
    expect(
      isItemExpiringSoon(
        item({
          id: "3",
          title: "x",
          expiresAt: isoDaysFromNow(3),
          status: "archived",
        }),
      ),
    ).toBe(false);
  });
});

describe("categoryLabel", () => {
  it("uses seed i18n then falls back to name", () => {
    const t = (key: string) => (key === "seed.food" ? "食物" : key);
    expect(categoryLabel(cat({ id: "1", name: "Food", slug: "food" }), t)).toBe("食物");
    expect(categoryLabel(cat({ id: "2", name: "Custom", slug: null }), t)).toBe("Custom");
    expect(categoryLabel(null, (k) => (k === "noCategory" ? "未分類" : k))).toBe("未分類");
  });
});

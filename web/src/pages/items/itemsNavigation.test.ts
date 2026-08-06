import { describe, expect, it } from "vitest";

import {
  ALL_CATEGORIES_ID,
  UNCATEGORIZED_CATEGORY_ID,
} from "../../domain/items/categoryAggregates";
import {
  buildItemsEditPath,
  buildItemsNewPath,
  resolveCreateInitialCategoryId,
  resolveItemFormBackPath,
} from "./itemsNavigation";

describe("buildItemsNewPath", () => {
  it("builds bare /items/new", () => {
    expect(buildItemsNewPath()).toBe("/items/new");
    expect(buildItemsNewPath({})).toBe("/items/new");
  });

  it("passes real category and workset", () => {
    expect(buildItemsNewPath({ categoryId: "food", worksetId: "ws-1" })).toBe(
      "/items/new?categoryId=food&worksetId=ws-1",
    );
  });

  it("keeps synthetic list-layer ids for return navigation", () => {
    expect(buildItemsNewPath({ categoryId: ALL_CATEGORIES_ID })).toBe(
      "/items/new?categoryId=all",
    );
    expect(buildItemsNewPath({ categoryId: UNCATEGORIZED_CATEGORY_ID })).toBe(
      "/items/new?categoryId=uncategorized",
    );
  });
});

describe("buildItemsEditPath", () => {
  it("builds edit path without query when no origin", () => {
    expect(buildItemsEditPath("item-1")).toBe("/items/item-1/edit");
  });

  it("encodes item id and attaches origin category", () => {
    expect(buildItemsEditPath("a/b", { categoryId: "docs" })).toBe(
      "/items/a%2Fb/edit?categoryId=docs",
    );
  });

  it("preserves worksetId when provided", () => {
    expect(
      buildItemsEditPath("item-1", { categoryId: "food", worksetId: "ws-1" }),
    ).toBe("/items/item-1/edit?categoryId=food&worksetId=ws-1");
  });
});

describe("resolveItemFormBackPath", () => {
  it("prefers explicit origin category over item category", () => {
    expect(
      resolveItemFormBackPath({
        categoryIdParam: ALL_CATEGORIES_ID,
        itemCategoryId: "food",
        itemKnown: true,
      }),
    ).toBe("/items/category/all");
  });

  it("returns the category list the user opened from", () => {
    expect(
      resolveItemFormBackPath({
        categoryIdParam: "food",
        itemCategoryId: null,
      }),
    ).toBe("/items/category/food");
  });

  it("returns uncategorized list when origin was uncategorized", () => {
    expect(
      resolveItemFormBackPath({
        categoryIdParam: UNCATEGORIZED_CATEGORY_ID,
        itemCategoryId: "food",
      }),
    ).toBe("/items/category/uncategorized");
  });

  it("falls back to item category on deep link / refresh", () => {
    expect(
      resolveItemFormBackPath({
        categoryIdParam: null,
        itemCategoryId: "docs",
        itemKnown: true,
      }),
    ).toBe("/items/category/docs");
  });

  it("falls back to uncategorized when loaded edit item has no category", () => {
    expect(
      resolveItemFormBackPath({
        categoryIdParam: null,
        itemCategoryId: null,
        itemKnown: true,
      }),
    ).toBe("/items/category/uncategorized");
  });

  it("falls back to items root when create has no origin", () => {
    expect(
      resolveItemFormBackPath({
        categoryIdParam: null,
        itemCategoryId: null,
        itemKnown: false,
      }),
    ).toBe("/items");
  });

  it("falls back to items root while edit item is still unknown", () => {
    expect(
      resolveItemFormBackPath({
        categoryIdParam: null,
        itemCategoryId: null,
        itemKnown: false,
      }),
    ).toBe("/items");
  });
});

describe("resolveCreateInitialCategoryId", () => {
  it("returns real category ids", () => {
    expect(resolveCreateInitialCategoryId("food")).toBe("food");
  });

  it("strips synthetic list-layer ids", () => {
    expect(resolveCreateInitialCategoryId(ALL_CATEGORIES_ID)).toBeNull();
    expect(resolveCreateInitialCategoryId(UNCATEGORIZED_CATEGORY_ID)).toBeNull();
    expect(resolveCreateInitialCategoryId(null)).toBeNull();
  });
});

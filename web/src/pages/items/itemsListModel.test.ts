import { describe, expect, it } from "vitest";

import type { TrackableItem } from "../../api/items";
import { ALL_CATEGORIES_ID, UNCATEGORIZED_CATEGORY_ID } from "../../domain/items/categoryAggregates";
import { makeTrackableItem } from "../../test/fixtures/trackableItem";
import {
  buildItemsListFetchParams,
  filterItemsList,
  groupItemsByWorkset,
  indexById,
  itemSearchHaystack,
  sortItemsList,
} from "./itemsListModel";

function item(overrides: Partial<TrackableItem> & { id: string }): TrackableItem {
  return makeTrackableItem(overrides);
}

describe("filterItemsList", () => {
  const rows = [
    item({ id: "a", title: "Milk", expiresAt: "2099-01-01T00:00:00.000Z" }),
    item({ id: "b", title: "Old", status: "archived" }),
    item({ id: "c", title: "Late", expiresAt: "2000-01-01T00:00:00.000Z" }),
  ];

  it("hides archived unless filter=archived", () => {
    expect(filterItemsList(rows, "all", "").map((r) => r.id)).toEqual(["a", "c"]);
    expect(filterItemsList(rows, "archived", "").map((r) => r.id)).toEqual(["b"]);
  });

  it("filters overdue and search needle", () => {
    expect(filterItemsList(rows, "overdue", "").map((r) => r.id)).toEqual(["c"]);
    expect(filterItemsList(rows, "all", "milk").map((r) => r.id)).toEqual(["a"]);
  });

  it("matches emoji and notes", () => {
    const withMeta = [
      item({ id: "e", title: "Pass", emoji: "🛂", notes: "brand Acme" }),
      item({ id: "n", title: "Other", notes: "shelf" }),
    ];
    expect(filterItemsList(withMeta, "all", "🛂").map((r) => r.id)).toEqual(["e"]);
    expect(filterItemsList(withMeta, "all", "acme").map((r) => r.id)).toEqual(["e"]);
    expect(filterItemsList(withMeta, "all", "shelf").map((r) => r.id)).toEqual(["n"]);
  });

  it("matches quantity and unit", () => {
    const rows = [
      item({ id: "q", title: "Rice", quantity: 2.5, unit: "kg" }),
      item({ id: "x", title: "Other" }),
    ];
    expect(filterItemsList(rows, "all", "kg").map((r) => r.id)).toEqual(["q"]);
    expect(filterItemsList(rows, "all", "2.5").map((r) => r.id)).toEqual(["q"]);
  });
});

describe("itemSearchHaystack", () => {
  it("includes title notes emoji and inventory", () => {
    const hay = itemSearchHaystack(
      item({
        id: "1",
        title: "Milk",
        notes: "Cold",
        emoji: "🥛",
        quantity: 2,
        unit: "L",
      }),
    );
    expect(hay).toContain("milk");
    expect(hay).toContain("cold");
    expect(hay).toContain("🥛");
    expect(hay).toContain("2");
    expect(hay).toContain("l");
    expect(hay).not.toContain("12.5");
  });
});

describe("buildItemsListFetchParams", () => {
  it("maps entry-list filters to listItems query params", () => {
    expect(
      buildItemsListFetchParams({
        categoryRouteId: ALL_CATEGORIES_ID,
        filter: "all",
        search: "",
        worksetFilterId: null,
      }),
    ).toEqual({ status: "active" });

    expect(
      buildItemsListFetchParams({
        categoryRouteId: UNCATEGORIZED_CATEGORY_ID,
        filter: "archived",
        search: " milk ",
        worksetFilterId: "ws-1",
      }),
    ).toEqual({
      categoryId: "",
      status: "archived",
      search: "milk",
      worksetId: "ws-1",
    });
  });
});

describe("sortItemsList", () => {
  it("returns a flat sorted list without workset sections", () => {
    const rows = [
      item({ id: "2", title: "Beta", expiresAt: "2026-02-01" }),
      item({ id: "1", title: "Alpha", expiresAt: "2026-01-01" }),
    ];
    expect(sortItemsList(rows, "name").map((r) => r.id)).toEqual(["1", "2"]);
    expect(sortItemsList(rows, "expiry").map((r) => r.id)).toEqual(["1", "2"]);
  });
});

describe("indexById", () => {
  it("maps entry pairs including personal workset __user__", () => {
    const personal = { id: "__user__", name: "Personal" };
    const other = { id: "ws-1", name: "Team" };
    const map = indexById([personal, other]);
    expect(map.get("__user__")).toEqual(personal);
    expect(map.get("ws-1")).toEqual(other);
    expect(map.size).toBe(2);
  });

  it("hardens against empty and malformed rows", () => {
    expect(indexById(null).size).toBe(0);
    expect(indexById(undefined).size).toBe(0);
    expect(indexById([]).size).toBe(0);
    const map = indexById([
      null as unknown as { id: string },
      { id: 1 as unknown as string },
      { id: "" },
      { id: "ok", name: "Keep" },
    ]);
    expect([...map.keys()]).toEqual(["ok"]);
  });
});

describe("groupItemsByWorkset", () => {
  it("preserves workset catalog order and sorts rows by expiry default", () => {
    const rows = [
      item({ id: "2", worksetId: "ws-b", categoryId: "z", expiresAt: "2026-02-01" }),
      item({ id: "1", worksetId: "ws-a", categoryId: "a", expiresAt: "2026-01-01" }),
      item({ id: "3", worksetId: "ws-b", categoryId: "a", expiresAt: "2026-01-15" }),
      item({ id: "orphan", worksetId: "ws-x" }),
    ];
    const grouped = groupItemsByWorkset(rows, ["ws-b", "ws-a"]);
    expect(grouped.map((g) => g.worksetId)).toEqual(["ws-b", "ws-a", "ws-x"]);
    expect(grouped[0].rows.map((r) => r.id)).toEqual(["3", "2"]);
  });

  it("sorts by name and updated when requested", () => {
    const rows = [
      item({
        id: "b",
        title: "Beta",
        worksetId: "ws",
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      item({
        id: "a",
        title: "Alpha",
        worksetId: "ws",
        updatedAt: "2026-02-01T00:00:00.000Z",
      }),
    ];
    expect(
      groupItemsByWorkset(rows, ["ws"], "name")[0].rows.map((r) => r.id),
    ).toEqual(["a", "b"]);
    expect(
      groupItemsByWorkset(rows, ["ws"], "updated")[0].rows.map((r) => r.id),
    ).toEqual(["a", "b"]);
  });
});

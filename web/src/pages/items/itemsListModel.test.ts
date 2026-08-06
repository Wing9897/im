import { describe, expect, it } from "vitest";

import type { TrackableItem } from "../../api/items";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import {
  filterItemsList,
  groupItemsByWorkset,
  itemSearchHaystack,
  sortItemsList,
} from "./itemsListModel";

function item(overrides: Partial<TrackableItem> & { id: string }): TrackableItem {
  return {
    title: overrides.id,
    notes: "",
    worksetId: SYSTEM_WORKSET_ID,
    categoryId: null,
    purchasedAt: null,
    expiresAt: null,
    remindBeforeDays: null,
    attributes: {},
    status: "active",
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
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

  it("matches emoji and attribute keys/values", () => {
    const withMeta = [
      item({ id: "e", title: "Pass", emoji: "🛂", attributes: { brand: "Acme" } }),
      item({ id: "n", title: "Other", notes: "shelf" }),
    ];
    expect(filterItemsList(withMeta, "all", "🛂").map((r) => r.id)).toEqual(["e"]);
    expect(filterItemsList(withMeta, "all", "acme").map((r) => r.id)).toEqual(["e"]);
    expect(filterItemsList(withMeta, "all", "brand").map((r) => r.id)).toEqual(["e"]);
    expect(filterItemsList(withMeta, "all", "shelf").map((r) => r.id)).toEqual(["n"]);
  });
});

describe("itemSearchHaystack", () => {
  it("includes title notes emoji and attributes", () => {
    const hay = itemSearchHaystack(
      item({
        id: "1",
        title: "Milk",
        notes: "Cold",
        emoji: "🥛",
        attributes: { fat: "2%" },
      }),
    );
    expect(hay).toContain("milk");
    expect(hay).toContain("cold");
    expect(hay).toContain("🥛");
    expect(hay).toContain("fat");
    expect(hay).toContain("2%");
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

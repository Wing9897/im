import { describe, expect, it } from "vitest";

import type { TrackableItem } from "../../api/items";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { filterItemsList, groupItemsByWorkset } from "./itemsListModel";

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
});

describe("groupItemsByWorkset", () => {
  it("preserves workset catalog order and sorts rows", () => {
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
});

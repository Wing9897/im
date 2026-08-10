import { describe, expect, it } from "vitest";
import type { TrackableItem } from "../../api/items";
import type { UserEvent } from "../../api/userEvents";
import { makeTrackableItem } from "../../test/fixtures/trackableItem";
import {
  buildItemsFinanceRows,
  financePresetRange,
  isLinkedPurchaseEffectiveTitle,
  purchaseEffectiveDayFromEvent,
  sortItemsFinanceRows,
  summarizeItemsFinance,
} from "./itemFinance";

function item(overrides: Partial<TrackableItem> & { id: string }): TrackableItem {
  return makeTrackableItem(overrides);
}

function event(overrides: Partial<UserEvent> & { id: string }): UserEvent {
  return {
    id: overrides.id,
    title: overrides.title ?? "Purchased",
    startTime: overrides.startTime ?? "2026-08-05T10:00:00",
    endTime: overrides.endTime ?? null,
    body: "",
    location: "",
    origin: "manual",
    isAllDay: false,
    itemId: overrides.itemId ?? "a",
    worksetId: "__user__",
    createdAt: "",
    updatedAt: "",
    dismissed: false,
    ...overrides,
  };
}

describe("itemFinance", () => {
  it("recognizes purchase/effective linked titles", () => {
    expect(isLinkedPurchaseEffectiveTitle("Purchased")).toBe(true);
    expect(isLinkedPurchaseEffectiveTitle("購入")).toBe(true);
    expect(isLinkedPurchaseEffectiveTitle("生效")).toBe(true);
    expect(isLinkedPurchaseEffectiveTitle("Expires")).toBe(false);
  });

  it("builds rows for events in inclusive day range", () => {
    const rows = buildItemsFinanceRows(
      [item({ id: "a", title: "Camera", price: 1200 })],
      [event({ id: "e1", itemId: "a", title: "Purchased", startTime: "2026-08-03T09:00:00" })],
      { startDay: "2026-08-01", endDay: "2026-08-10" },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.purchaseDay).toBe("2026-08-03");
    expect(rows[0]?.price).toBe(1200);
  });

  it("excludes dismissed and out-of-range events", () => {
    const rows = buildItemsFinanceRows(
      [item({ id: "a" })],
      [
        event({ id: "e1", dismissed: true }),
        event({ id: "e2", startTime: "2026-07-01T09:00:00" }),
      ],
      { startDay: "2026-08-01", endDay: "2026-08-10" },
    );
    expect(rows).toHaveLength(0);
  });

  it("summarizes priced rows", () => {
    const rows = buildItemsFinanceRows(
      [
        item({ id: "a", price: 10 }),
        item({ id: "b", price: null }),
      ],
      [
        event({ id: "e1", itemId: "a" }),
        event({ id: "e2", itemId: "b" }),
      ],
      { startDay: "2026-08-01", endDay: "2026-08-31" },
    );
    const summary = summarizeItemsFinance(rows);
    expect(summary.rowCount).toBe(2);
    expect(summary.pricedCount).toBe(1);
    expect(summary.totalCost).toBe(10);
  });

  it("sorts by purchase date descending by default helper", () => {
    const rows = buildItemsFinanceRows(
      [item({ id: "a" }), item({ id: "b" })],
      [
        event({ id: "e1", itemId: "a", startTime: "2026-08-01T09:00:00" }),
        event({ id: "e2", itemId: "b", startTime: "2026-08-09T09:00:00" }),
      ],
      { startDay: "2026-08-01", endDay: "2026-08-31" },
    );
    const sorted = sortItemsFinanceRows(rows, "purchaseDateDesc");
    expect(sorted.map((r) => r.purchaseDay)).toEqual(["2026-08-09", "2026-08-01"]);
  });

  it("derives day from all-day events", () => {
    const day = purchaseEffectiveDayFromEvent(
      event({ id: "e", isAllDay: true, startTime: "2026-08-15" }),
    );
    expect(day).toBeTruthy();
  });

  it("financePresetRange covers this month through today", () => {
    const now = new Date("2026-08-10T12:00:00");
    const range = financePresetRange("thisMonth", now);
    expect(range.startDay).toBe("2026-08-01");
    expect(range.endDay).toBe("2026-08-10");
  });
});

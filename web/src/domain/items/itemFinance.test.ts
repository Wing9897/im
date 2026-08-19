import { describe, expect, it } from "vitest";
import type { TrackableItem } from "../../api/items";
import type { UserEvent } from "../../api/userEvents";
import { makeTrackableItem } from "../../test/fixtures/trackableItem";
import { LINKED_PURCHASE_EFFECTIVE_TITLES } from "../timeline/userEventCalendarKind";
import {
  buildItemsFinanceRows,
  financePresetRange,
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
    kind: overrides.kind ?? "purchase_effective",
    startTime: overrides.startTime ?? "2026-08-05T10:00:00",
    endTime: overrides.endTime ?? null,
    body: "",
    location: null,
    origin: "manual",
    isAllDay: false,
    taskId: "",
    itemId: overrides.itemId ?? "a",
    worksetId: "__general__",
    source: "user",
    createdAt: "",
    updatedAt: "",
    dismissed: false,
    important: false,
    amount: overrides.amount ?? null,
    direction: overrides.direction ?? null,
    ...overrides,
  };
}

describe("itemFinance", () => {
  it("documents purchase/effective linked title presets", () => {
    expect(LINKED_PURCHASE_EFFECTIVE_TITLES.has("Purchased")).toBe(true);
    expect(LINKED_PURCHASE_EFFECTIVE_TITLES.has("購入")).toBe(true);
    expect(LINKED_PURCHASE_EFFECTIVE_TITLES.has("生效")).toBe(true);
    expect(LINKED_PURCHASE_EFFECTIVE_TITLES.has("Expires")).toBe(false);
  });

  it("builds rows from event amount and direction", () => {
    const rows = buildItemsFinanceRows(
      [item({ id: "a", title: "Camera" })],
      [
        event({
          id: "e1",
          itemId: "a",
          title: "Purchased",
          kind: "purchase_effective",
          startTime: "2026-08-03T09:00:00",
          amount: 1200,
          direction: "expense",
        }),
      ],
      { startDay: "2026-08-01", endDay: "2026-08-10" },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.purchaseDay).toBe("2026-08-03");
    expect(rows[0]?.amount).toBe(1200);
    expect(rows[0]?.direction).toBe("expense");
  });

  it("excludes dismissed and out-of-range events", () => {
    const rows = buildItemsFinanceRows(
      [item({ id: "a" })],
      [
        event({ id: "e1", dismissed: true, amount: 10 }),
        event({ id: "e2", startTime: "2026-07-01T09:00:00", amount: 10 }),
      ],
      { startDay: "2026-08-01", endDay: "2026-08-10" },
    );
    expect(rows).toHaveLength(0);
  });

  it("summarizes expense and income separately", () => {
    const rows = buildItemsFinanceRows(
      [item({ id: "a" }), item({ id: "b" }), item({ id: "c" })],
      [
        event({ id: "e1", itemId: "a", amount: 100, direction: "expense" }),
        event({ id: "e2", itemId: "b", amount: 40, direction: "income" }),
        event({ id: "e3", itemId: "c", amount: null }),
      ],
      { startDay: "2026-08-01", endDay: "2026-08-31" },
    );
    const summary = summarizeItemsFinance(rows);
    expect(summary.rowCount).toBe(3);
    expect(summary.withAmountCount).toBe(2);
    expect(summary.totalExpense).toBe(100);
    expect(summary.totalIncome).toBe(40);
    expect(summary.net).toBe(60);
  });

  it("sorts by purchase date descending by default helper", () => {
    const rows = buildItemsFinanceRows(
      [item({ id: "a" }), item({ id: "b" })],
      [
        event({ id: "e1", itemId: "a", startTime: "2026-08-01T09:00:00", amount: 1 }),
        event({ id: "e2", itemId: "b", startTime: "2026-08-09T09:00:00", amount: 2 }),
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

  it("ignores purchase titles when kind is normal", () => {
    const rows = buildItemsFinanceRows(
      [item({ id: "a", title: "Camera" })],
      [
        event({
          id: "e1",
          itemId: "a",
          title: "Purchased",
          kind: "normal",
          amount: 1200,
          direction: "expense",
        }),
      ],
      { startDay: "2026-08-01", endDay: "2026-08-10" },
    );
    expect(rows).toHaveLength(0);
  });
});

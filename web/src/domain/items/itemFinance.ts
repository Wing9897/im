/**
 * Items finance v1 — purchase_effective linked calendars in a date window.
 * Totals come from event ``amount`` + ``direction`` (not item fields).
 * Full P&L (resale, depreciation, multi-currency) is out of scope here.
 */

import type { TrackableItem } from "../../api/items";
import type { UserEvent } from "../../api/userEvents";
import { formatDateOnly } from "../../utils/dateFormat";
import { addDays, startOfDay, startOfMonth, startOfYear, todayDateInput } from "../timeline/dateUtils";
import { isPurchaseEffectiveCalendarEvent } from "../timeline/userEventCalendarKind";

export type EventFinanceDirection = "expense" | "income";

export type ItemsFinancePlFilter = "all" | "withAmount" | "missingAmount";

export type ItemsFinanceSortKey =
  | "purchaseDateDesc"
  | "purchaseDateAsc"
  | "amountDesc"
  | "amountAsc";

export type ItemsFinancePreset = "thisMonth" | "last30" | "thisYear" | "custom";

export type ItemsFinanceRange = {
  startDay: string;
  endDay: string;
};

export type ItemsFinanceRow = {
  itemId: string;
  title: string;
  amount: number | null;
  direction: EventFinanceDirection | null;
  purchaseDay: string;
  purchaseEventTitle: string;
  eventId: string;
};

export type ItemsFinanceSummary = {
  rowCount: number;
  withAmountCount: number;
  totalExpense: number;
  totalIncome: number;
  /** Expense − income for the filtered rows. */
  net: number;
};

/** Local calendar day (YYYY-MM-DD) for range checks — all-day uses start date only. */
export function purchaseEffectiveDayFromEvent(event: UserEvent): string | null {
  if (!event.startTime?.trim()) return null;
  const startMs = Date.parse(event.startTime);
  if (Number.isFinite(startMs)) {
    if (event.isAllDay) {
      return formatDateOnly(startMs) || event.startTime.slice(0, 10);
    }
    const match = /^(\d{4}-\d{2}-\d{2})/.exec(event.startTime.trim());
    return match?.[1] ?? null;
  }
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(event.startTime.trim());
  return match?.[1] ?? null;
}

function isDayInInclusiveRange(day: string, startDay: string, endDay: string): boolean {
  if (!day || !startDay || !endDay) return false;
  if (startDay <= endDay) {
    return day >= startDay && day <= endDay;
  }
  return day >= endDay && day <= startDay;
}

export function financePresetRange(
  preset: ItemsFinancePreset,
  now = new Date(),
): ItemsFinanceRange {
  const today = todayDateInput(now);
  switch (preset) {
    case "last30": {
      const start = addDays(startOfDay(now), -29);
      return { startDay: todayDateInput(start), endDay: today };
    }
    case "thisYear":
      return { startDay: todayDateInput(startOfYear(now)), endDay: today };
    case "thisMonth":
    case "custom":
    default:
      return { startDay: todayDateInput(startOfMonth(now)), endDay: today };
  }
}

/** ISO window for `listUserEventsPage({ startTime, endTime })` (local day bounds). */
export function financeEventsQueryWindow(range: ItemsFinanceRange): { startTime: string; endTime: string } {
  const startMs = Date.parse(`${range.startDay}T00:00:00`);
  const endMs = Date.parse(`${range.endDay}T23:59:59.999`);
  const startTime = Number.isFinite(startMs) ? new Date(startMs).toISOString() : range.startDay;
  const endTime = Number.isFinite(endMs) ? new Date(endMs).toISOString() : range.endDay;
  return { startTime, endTime };
}

function itemTitleById(items: readonly TrackableItem[]): Map<string, TrackableItem> {
  return new Map(items.map((row) => [row.id, row]));
}

function normalizeDirection(
  value: string | null | undefined,
  amount: number | null,
): EventFinanceDirection | null {
  if (amount == null || !Number.isFinite(amount)) return null;
  return value === "income" ? "income" : "expense";
}

/**
 * One row per purchase/effective event in range (same item may appear twice).
 * v1 does not dedupe by item — earliest-in-range is a later enhancement.
 */
export function buildItemsFinanceRows(
  items: readonly TrackableItem[],
  events: readonly UserEvent[],
  range: ItemsFinanceRange,
): ItemsFinanceRow[] {
  const byId = itemTitleById(items);
  const rows: ItemsFinanceRow[] = [];

  for (const event of events) {
    if (event.dismissed) continue;
    if (!event.itemId?.trim()) continue;
    if (!isPurchaseEffectiveCalendarEvent(event)) continue;
    const day = purchaseEffectiveDayFromEvent(event);
    if (!day || !isDayInInclusiveRange(day, range.startDay, range.endDay)) continue;

    const item = byId.get(event.itemId);
    if (!item) continue;

    const amount =
      event.amount != null && Number.isFinite(event.amount) ? Number(event.amount) : null;
    rows.push({
      itemId: item.id,
      title: item.title,
      amount,
      direction: normalizeDirection(event.direction, amount),
      purchaseDay: day,
      purchaseEventTitle: event.title,
      eventId: event.id,
    });
  }

  return rows;
}

export function filterItemsFinanceRows(
  rows: readonly ItemsFinanceRow[],
  plFilter: ItemsFinancePlFilter,
): ItemsFinanceRow[] {
  switch (plFilter) {
    case "withAmount":
      return rows.filter((row) => row.amount != null && Number.isFinite(row.amount));
    case "missingAmount":
      return rows.filter((row) => row.amount == null || !Number.isFinite(row.amount));
    case "all":
    default:
      return [...rows];
  }
}

export function sortItemsFinanceRows(
  rows: readonly ItemsFinanceRow[],
  sort: ItemsFinanceSortKey,
): ItemsFinanceRow[] {
  const copy = [...rows];
  copy.sort((a, b) => {
    switch (sort) {
      case "purchaseDateAsc":
        return a.purchaseDay.localeCompare(b.purchaseDay) || a.title.localeCompare(b.title);
      case "amountDesc": {
        const pa = a.amount ?? -Infinity;
        const pb = b.amount ?? -Infinity;
        return pb - pa || a.purchaseDay.localeCompare(b.purchaseDay);
      }
      case "amountAsc": {
        const pa = a.amount ?? Infinity;
        const pb = b.amount ?? Infinity;
        return pa - pb || a.purchaseDay.localeCompare(b.purchaseDay);
      }
      case "purchaseDateDesc":
      default:
        return b.purchaseDay.localeCompare(a.purchaseDay) || a.title.localeCompare(b.title);
    }
  });
  return copy;
}

export function summarizeItemsFinance(rows: readonly ItemsFinanceRow[]): ItemsFinanceSummary {
  let totalExpense = 0;
  let totalIncome = 0;
  let withAmountCount = 0;
  for (const row of rows) {
    if (row.amount == null || !Number.isFinite(row.amount)) continue;
    withAmountCount += 1;
    if (row.direction === "income") {
      totalIncome += row.amount;
    } else {
      totalExpense += row.amount;
    }
  }
  return {
    rowCount: rows.length,
    withAmountCount,
    totalExpense,
    totalIncome,
    net: totalExpense - totalIncome,
  };
}

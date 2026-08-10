/**
 * Items finance v1 — purchase/effective linked calendars in a date window.
 * Full P&L (resale, depreciation, multi-currency) is out of scope here.
 */

import type { TrackableItem } from "../../api/items";
import type { UserEvent } from "../../api/userEvents";
import { formatDateOnly } from "../../utils/dateFormat";
import { addDays, startOfDay, startOfMonth, startOfYear, todayDateInput } from "../timeline/dateUtils";

/** Quick-create preset titles + common「生效 / Effective」variants. */
export const LINKED_PURCHASE_EFFECTIVE_TITLES = new Set([
  "Purchased",
  "购入",
  "購入",
  "Effective",
  "生效",
]);

export type ItemsFinancePlFilter = "all" | "withCost" | "missingCost";

export type ItemsFinanceSortKey = "purchaseDateDesc" | "purchaseDateAsc" | "priceDesc" | "priceAsc";

export type ItemsFinancePreset = "thisMonth" | "last30" | "thisYear" | "custom";

export type ItemsFinanceRange = {
  startDay: string;
  endDay: string;
};

export type ItemsFinanceRow = {
  itemId: string;
  title: string;
  price: number | null;
  purchaseDay: string;
  purchaseEventTitle: string;
  eventId: string;
};

export type ItemsFinanceSummary = {
  rowCount: number;
  pricedCount: number;
  totalCost: number;
};

export function isLinkedPurchaseEffectiveTitle(title: string | null | undefined): boolean {
  return LINKED_PURCHASE_EFFECTIVE_TITLES.has(String(title ?? "").trim());
}

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

export function isDayInInclusiveRange(day: string, startDay: string, endDay: string): boolean {
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

/** ISO window for `listUserEvents({ start, end })` (local day bounds). */
export function financeEventsQueryWindow(range: ItemsFinanceRange): { start: string; end: string } {
  const startMs = Date.parse(`${range.startDay}T00:00:00`);
  const endMs = Date.parse(`${range.endDay}T23:59:59.999`);
  const start = Number.isFinite(startMs) ? new Date(startMs).toISOString() : range.startDay;
  const end = Number.isFinite(endMs) ? new Date(endMs).toISOString() : range.endDay;
  return { start, end };
}

function itemTitleById(items: readonly TrackableItem[]): Map<string, TrackableItem> {
  return new Map(items.map((row) => [row.id, row]));
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
    if (!isLinkedPurchaseEffectiveTitle(event.title)) continue;
    const day = purchaseEffectiveDayFromEvent(event);
    if (!day || !isDayInInclusiveRange(day, range.startDay, range.endDay)) continue;

    const item = byId.get(event.itemId);
    if (!item) continue;

    rows.push({
      itemId: item.id,
      title: item.title,
      price: item.price ?? null,
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
    case "withCost":
      return rows.filter((row) => row.price != null && Number.isFinite(row.price));
    case "missingCost":
      return rows.filter((row) => row.price == null || !Number.isFinite(row.price));
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
      case "priceDesc": {
        const pa = a.price ?? -Infinity;
        const pb = b.price ?? -Infinity;
        return pb - pa || a.purchaseDay.localeCompare(b.purchaseDay);
      }
      case "priceAsc": {
        const pa = a.price ?? Infinity;
        const pb = b.price ?? Infinity;
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
  let totalCost = 0;
  let pricedCount = 0;
  for (const row of rows) {
    if (row.price != null && Number.isFinite(row.price)) {
      totalCost += row.price;
      pricedCount += 1;
    }
  }
  return { rowCount: rows.length, pricedCount, totalCost };
}

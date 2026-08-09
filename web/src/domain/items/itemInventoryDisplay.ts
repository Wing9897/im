import type { TrackableItem } from "../../api/items";

/** Compact card line for quantity + unit, e.g. "× 3 盒". */
export function formatItemQuantityUnit(
  quantity: number | null | undefined,
  unit: string | null | undefined,
): string | null {
  if (quantity == null || Number.isNaN(quantity)) return null;
  const unitLabel = unit?.trim();
  const qtyText = Number.isInteger(quantity) ? String(quantity) : String(quantity);
  if (!unitLabel) return `× ${qtyText}`;
  return `× ${qtyText} ${unitLabel}`;
}

/** Price display with unified $ prefix. */
export function formatItemPrice(price: number | null | undefined): string | null {
  if (price == null || Number.isNaN(price)) return null;
  const hasFraction = Math.round(price * 100) % 100 !== 0;
  const formatted = hasFraction
    ? price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : price.toLocaleString(undefined, { maximumFractionDigits: 0 });
  return `$ ${formatted}`;
}

export function itemInventorySummary(item: Pick<TrackableItem, "quantity" | "unit" | "price">): string | null {
  const parts: string[] = [];
  const qtyLine = formatItemQuantityUnit(item.quantity, item.unit);
  const priceLine = formatItemPrice(item.price);
  if (qtyLine) parts.push(qtyLine);
  if (priceLine) parts.push(priceLine);
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Parse optional numeric form input to wire value (null when empty). */
export function parseOptionalNumberInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

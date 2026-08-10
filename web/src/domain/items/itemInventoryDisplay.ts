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

export function itemInventorySummary(
  item: Pick<TrackableItem, "quantity" | "unit">,
): string | null {
  return formatItemQuantityUnit(item.quantity, item.unit);
}

/** Parse optional numeric form input to wire value (null when empty). */
export function parseOptionalNumberInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

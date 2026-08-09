import type { ItemWriteParams, TrackableItem } from "../../api/items";

/** Build create body for a duplicate — scalar fields only; no linked calendars or date cache. */
export function buildDuplicateItemBody(
  source: TrackableItem,
  titleSuffix: string,
): ItemWriteParams {
  return {
    title: `${source.title}${titleSuffix}`,
    worksetId: source.worksetId,
    categoryId: source.categoryId,
    notes: source.notes ?? "",
    emoji: source.emoji ?? null,
    quantity: source.quantity ?? null,
    unit: source.unit ?? null,
    price: source.price ?? null,
    attributes: { ...(source.attributes ?? {}) },
    status: "active",
  };
}

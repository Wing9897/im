import type { TrackableItem } from "../../api/items";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";

/** Shared TrackableItem factory for web tests. */
export function makeTrackableItem(
  partial: Partial<TrackableItem> & Pick<TrackableItem, "id"> = { id: "item-1" },
): TrackableItem {
  return {
    title: partial.title ?? partial.id,
    worksetId: SYSTEM_WORKSET_ID,
    categoryId: null,
    expiresAt: null,
    remindBeforeDays: null,
    notes: "",
    status: "active",
    emoji: null,
    quantity: null,
    unit: null,
    price: null,
    attributes: {},
    createdAt: null,
    updatedAt: null,
    ...partial,
  };
}

/** Default passport-like item used by ItemForm integration tests. */
export function makeItemFormPassportItem(
  partial: Partial<TrackableItem> = {},
): TrackableItem {
  return makeTrackableItem({
    id: "item-1",
    title: "Passport",
    categoryId: "seed_passport_docs",
    expiresAt: "2030-01-01",
    remindBeforeDays: 14,
    attributes: { id_number: "A123456", custom_tag: "keep-me" },
    ...partial,
  });
}

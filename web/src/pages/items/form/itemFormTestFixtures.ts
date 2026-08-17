import type { ItemCategory } from "../../../api/items";
import { SYSTEM_WORKSET_ID } from "../../../types/worksets";

/** Minimal category factory for component-level items tests. */
export function makeItemCategory(
  partial: Partial<ItemCategory> & Pick<ItemCategory, "id" | "name">,
): ItemCategory {
  return {
    slug: null,
    sortOrder: 0,
    color: null,
    emoji: null,
    defaultRemindBeforeDays: null,
    createdAt: null,
    updatedAt: null,
    ...partial,
  };
}

export const ITEM_FORM_TEST_CATEGORIES: ItemCategory[] = [
  {
    id: "seed_passport_docs",
    name: "證件",
    slug: "passport_docs",
    sortOrder: 10,
    color: null,
    emoji: "🪪",
    defaultRemindBeforeDays: 90,
    createdAt: null,
    updatedAt: null,
  },
  {
    id: "seed_food",
    name: "食物",
    slug: "food",
    sortOrder: 20,
    color: null,
    emoji: "🍎",
    defaultRemindBeforeDays: 3,
    createdAt: null,
    updatedAt: null,
  },
];

export const ITEM_FORM_TEST_WORKSETS = [
  {
    id: SYSTEM_WORKSET_ID,
    name: "General",
    isSystem: true,
    notifyEnabled: true,
    externalEnabled: true,
    createdAt: "",
    updatedAt: "",
  },
];

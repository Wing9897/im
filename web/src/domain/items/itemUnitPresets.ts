/** Common unit labels for trackable items (Traditional Chinese + English aliases). */
export const ITEM_UNIT_PRESETS = [
  "個",
  "件",
  "盒",
  "包",
  "瓶",
  "袋",
  "克",
  "公斤",
  "毫升",
  "升",
  "米",
  "台",
  "張",
  "pcs",
  "kg",
  "g",
  "ml",
  "L",
] as const;

export type ItemUnitPreset = (typeof ITEM_UNIT_PRESETS)[number];

/**
 * Thin helpers for trackable-item calendar rows.
 *
 * Projection lives on the server (`item_projection` → GET /calendar/items).
 * This module only formats display titles (i18n) and occurrence ids.
 */

import i18n from "../../i18n";

export type ItemDateKind = "purchased" | "expires" | "remind";

export function itemOccurrenceId(itemId: string, kind: ItemDateKind): string {
  return `item:${itemId}:${kind}`;
}

function prefixKeyForKind(kind: ItemDateKind | string | null | undefined): string {
  if (kind === "expires") return "items:expiresPrefix";
  if (kind === "remind") return "items:remindPrefix";
  return "items:purchasedPrefix";
}

/** i18n display title: `{prefix} · {bareTitle}` (server sends bare title). */
export function formatItemOccurrenceTitle(
  kind: ItemDateKind | string | null | undefined,
  bareTitle: string,
): string {
  const prefix = String(i18n.t(prefixKeyForKind(kind)));
  const title = bareTitle.trim();
  return title ? `${prefix} · ${title}` : prefix;
}

/** Prefer item emoji, else category emoji. */
export function resolveItemEmoji(
  item: { emoji?: string | null } | null | undefined,
  category?: { emoji?: string | null } | null,
): string | null {
  const fromItem = item?.emoji?.trim();
  if (fromItem) return fromItem;
  const fromCat = category?.emoji?.trim();
  return fromCat || null;
}

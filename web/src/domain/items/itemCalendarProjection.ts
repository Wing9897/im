/**
 * Thin helpers for trackable-item calendar rows.
 *
 * Projection lives on the server (`item_projection` → GET /calendar/items).
 * This module only formats display titles (i18n) and occurrence ids.
 */

import i18n from "../../i18n";

export type ItemDateKind = "purchased" | "expires";

export function itemOccurrenceId(itemId: string, kind: ItemDateKind): string {
  return `item:${itemId}:${kind}`;
}

/** i18n display title: `{prefix} · {bareTitle}` (server sends bare title). */
export function formatItemOccurrenceTitle(
  kind: ItemDateKind | string | null | undefined,
  bareTitle: string,
): string {
  const prefixKey =
    kind === "expires" ? "items:expiresPrefix" : "items:purchasedPrefix";
  const prefix = String(i18n.t(prefixKey));
  const title = bareTitle.trim();
  return title ? `${prefix} · ${title}` : prefix;
}

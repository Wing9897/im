/**
 * Thin helpers for trackable-item calendar rows.
 *
 * Projection lives on the server (`item_projection` → GET /calendar/items).
 * This module only formats display titles (i18n) and occurrence ids.
 */

import i18n from "../../i18n";

export type ItemDateKind = "purchased" | "expires" | "remind";

/** Clear default when neither item nor category has an emoji. */
export const DEFAULT_ITEM_EMOJI = "📦";

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

/** i18n short label for badges (same keys as title prefixes). */
export function itemDateKindLabel(
  kind: ItemDateKind | string | null | undefined,
): string {
  return String(i18n.t(prefixKeyForKind(kind)));
}

/**
 * Prefer item emoji, else category emoji, else a clear package fallback.
 * Always returns a non-empty display string for type cards / list rows.
 */
export function resolveItemEmoji(
  item: { emoji?: string | null } | null | undefined,
  category?: { emoji?: string | null } | null,
): string {
  const fromItem = item?.emoji?.trim();
  if (fromItem) return fromItem;
  const fromCat = category?.emoji?.trim();
  if (fromCat) return fromCat;
  return DEFAULT_ITEM_EMOJI;
}

/** Badge tone for remind vs expires vs purchased in list/sidebar. */
export function itemDateKindBadgeTone(
  kind: ItemDateKind | string | null | undefined,
): "warning" | "danger" | "info" | "neutral" {
  if (kind === "remind") return "warning";
  if (kind === "expires") return "danger";
  if (kind === "purchased") return "info";
  return "neutral";
}

/** Month-cell / list accent class for item kind dots (design-system tokens). */
export function itemDateKindDotClass(
  kind: ItemDateKind | string | null | undefined,
): string {
  if (kind === "remind") {
    return "h-1 w-1 shrink-0 rounded-full bg-[var(--calendar-dot-ending)] opacity-90";
  }
  if (kind === "expires") {
    return "h-1 w-1 shrink-0 rounded-full bg-[var(--error)] opacity-90";
  }
  if (kind === "purchased") {
    return "h-1 w-1 shrink-0 rounded-full bg-[var(--calendar-dot-ongoing)] opacity-90";
  }
  return "h-1 w-1 shrink-0 rounded-full bg-[var(--calendar-dot-event)] opacity-80";
}

/**
 * Trackable-item display helpers for calendar rows and Items / workset UI.
 *
 * Occurrence projection lives on the server (`item_projection` → GET /calendar/items)
 * and includes purchased / expires / remind floating all-day markers. This module
 * only formats titles (i18n), occurrence ids, and calendar kind glyphs
 * (tiny emoji markers — not chromatic dots). Card remind badges live in
 * `eventShowsRemindBadge` / `resolveEventCardDisplay`.
 */

import i18n from "../../i18n";
import {
  ALL_CATEGORIES_ID,
  UNCATEGORIZED_CATEGORY_ID,
} from "./categoryAggregates";

export type ItemDateKind = "purchased" | "expires" | "remind";

/**
 * Calendar-row kind glyphs (distinct from the item's own brand emoji).
 * Kept tiny in UI via {@link itemDateKindMarkerClass}.
 */
export const ITEM_DATE_KIND_EMOJI: Readonly<Record<ItemDateKind, string>> = {
  purchased: "🛒",
  remind: "🔔",
  expires: "⚠️",
};

/**
 * Visual language for Items / workset item cards:
 * - Type & item brand → emoji (this module). Ops / nav → Lucide elsewhere.
 * - Fallback package is shared with seed slug `other`; synthetic cards use distinct marks.
 */
/** Clear default when neither item nor category has an emoji. */
export const DEFAULT_ITEM_EMOJI = "📦";

/** Synthetic「全部类型」card — must not collide with seed insurance (was 📋). */
export const ALL_CATEGORIES_EMOJI = "🗂️";

/** Synthetic「未分类」card — distinct from seed `other` / default package. */
export const UNCATEGORIZED_EMOJI = "🏷️";

export function itemOccurrenceId(itemId: string, kind: ItemDateKind): string {
  return `item:${itemId}:${kind}`;
}

function prefixKeyForKind(kind: string | null | undefined): string {
  if (kind === "expires") return "items:expiresPrefix";
  if (kind === "remind") return "items:remindPrefix";
  return "items:purchasedPrefix";
}

/** i18n display title: `{prefix} · {bareTitle}` (server sends bare title). */
export function formatItemOccurrenceTitle(
  kind: string | null | undefined,
  bareTitle: string,
): string {
  const prefix = String(i18n.t(prefixKeyForKind(kind)));
  const title = bareTitle.trim();
  return title ? `${prefix} · ${title}` : prefix;
}

/** i18n short label for badges (same keys as title prefixes). */
export function itemDateKindLabel(
  kind: string | null | undefined,
): string {
  return String(i18n.t(prefixKeyForKind(kind)));
}

/**
 * Strip `{prefix} · ` when the UI already conveys kind (badge / tag) or when
 * purchase / expiry should read as a normal event (plain title + standard dot).
 */
export function stripItemKindTitlePrefix(
  kind: string | null | undefined,
  title: string,
): string {
  if (kind !== "remind" && kind !== "expires" && kind !== "purchased") {
    return title.trim();
  }
  const prefix = itemDateKindLabel(kind);
  const trimmed = title.trim();
  const dotted = `${prefix} · `;
  if (trimmed.startsWith(dotted)) {
    return trimmed.slice(dotted.length).trim();
  }
  return trimmed;
}

type EmojiSource = {
  slug?: string | null;
  emoji?: string | null;
} | null | undefined;

/**
 * Category brand emoji: stored emoji → package fallback.
 * (Wipe-only stamp ships DDL seed glyphs; no FE overlay for legacy drift.)
 */
export function resolveCategoryEmoji(category?: EmojiSource): string {
  const fromCat = category?.emoji?.trim();
  if (fromCat) return fromCat;
  return DEFAULT_ITEM_EMOJI;
}

/**
 * Emoji for type-layer cards, including synthetic all / uncategorized sentinels.
 */
export function resolveCategoryCardEmoji(
  summaryId: string,
  category?: EmojiSource,
): string {
  if (summaryId === ALL_CATEGORIES_ID) return ALL_CATEGORIES_EMOJI;
  if (summaryId === UNCATEGORIZED_CATEGORY_ID) return UNCATEGORIZED_EMOJI;
  return resolveCategoryEmoji(category);
}

/**
 * Prefer item emoji, else category brand, else package fallback.
 * Always returns a non-empty display string for type cards / list rows.
 */
export function resolveItemEmoji(
  item: { emoji?: string | null } | null | undefined,
  category?: EmojiSource,
): string {
  const fromItem = item?.emoji?.trim();
  if (fromItem) return fromItem;
  return resolveCategoryEmoji(category);
}

/** Glyph for an item DATE kind (🛒 / 🔔 / ⚠️). Falls back to package for unknown. */
export function itemDateKindEmoji(kind: string | null | undefined): string {
  if (kind === "purchased" || kind === "remind" || kind === "expires") {
    return ITEM_DATE_KIND_EMOJI[kind];
  }
  return DEFAULT_ITEM_EMOJI;
}

/**
 * Tiny emoji marker box (~dot visual weight next to month preview text).
 * Pair with {@link itemDateKindEmoji} as children — not a colored disk.
 */
export function itemDateKindMarkerClass(
  _kind?: string | null,
): string {
  return (
    "inline-flex h-2.5 w-2.5 shrink-0 items-center justify-center " +
    "overflow-hidden text-[8px] leading-none opacity-90"
  );
}

/**
 * Trackable-item display helpers for calendar rows and Items / workset UI.
 *
 * Occurrence projection lives on the server (`item_projection` → GET /calendar/items)
 * and includes purchased / expires / remind floating all-day markers. This module
 * only formats titles (i18n), occurrence ids, badge/dot tones, and emoji brand marks.
 */

import i18n from "../../i18n";
import {
  ALL_CATEGORIES_ID,
  UNCATEGORIZED_CATEGORY_ID,
} from "./categoryAggregates";

export type ItemDateKind = "purchased" | "expires" | "remind";

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

/** Badge tone for remind vs expires vs purchased in list/sidebar. */
export function itemDateKindBadgeTone(
  kind: string | null | undefined,
): "warning" | "danger" | "info" | "neutral" {
  if (kind === "remind") return "warning";
  if (kind === "expires") return "danger";
  if (kind === "purchased") return "info";
  return "neutral";
}

/** Month-cell / list accent class for item kind dots (design-system tokens). */
export function itemDateKindDotClass(
  kind: string | null | undefined,
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

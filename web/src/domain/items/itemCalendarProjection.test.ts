import { beforeEach, describe, expect, it } from "vitest";

import i18n from "../../i18n";
import { setAppLocale } from "../../i18n/locale";
import {
  ALL_CATEGORIES_EMOJI,
  DEFAULT_ITEM_EMOJI,
  ITEM_DATE_KIND_EMOJI,
  UNCATEGORIZED_EMOJI,
  formatItemOccurrenceTitle,
  itemDateKindEmoji,
  itemDateKindLabel,
  itemDateKindMarkerClass,
  stripItemKindTitlePrefix,
  itemOccurrenceId,
  resolveCategoryCardEmoji,
  resolveCategoryEmoji,
  resolveItemEmoji,
} from "./itemCalendarProjection";
import { ALL_CATEGORIES_ID, UNCATEGORIZED_CATEGORY_ID } from "./categoryAggregates";

/** Canonical seed emojis from `server/db/schema_domains/items.py` INSERT OR IGNORE rows. */
const DDL_SEED_CATEGORY_EMOJIS: Readonly<Record<string, string>> = {
  passport_docs: "🪪",
  food: "🍎",
  credit_card: "💳",
  warranty: "🛡️",
  contract: "📄",
  household: "🏠",
  medicine: "💊",
  subscription: "🔁",
  membership: "🎫",
  insurance: "☂️",
  vehicle: "🚗",
  other: "📦",
};

describe("itemCalendarProjection helpers", () => {
  beforeEach(async () => {
    await setAppLocale("zh-Hant");
  });

  it("builds stable occurrence ids", () => {
    expect(itemOccurrenceId("abc", "purchased")).toBe("item:abc:purchased");
    expect(itemOccurrenceId("abc", "expires")).toBe("item:abc:expires");
    expect(itemOccurrenceId("abc", "remind")).toBe("item:abc:remind");
  });

  it("formats titles with i18n prefixes (not hardcoded 購入)", () => {
    expect(formatItemOccurrenceTitle("purchased", "Milk")).toBe(
      `${String(i18n.t("items:purchasedPrefix"))} · Milk`,
    );
    expect(formatItemOccurrenceTitle("expires", "Milk")).toBe(
      `${String(i18n.t("items:expiresPrefix"))} · Milk`,
    );
    expect(formatItemOccurrenceTitle("remind", "Milk")).toBe(
      `${String(i18n.t("items:remindPrefix"))} · Milk`,
    );
  });

  it("strips remind/expires/purchased prefixes for plain-title surfaces", () => {
    const remind = `${String(i18n.t("items:remindPrefix"))} · Milk`;
    const expires = `${String(i18n.t("items:expiresPrefix"))} · Milk`;
    const purchased = `${String(i18n.t("items:purchasedPrefix"))} · Milk`;
    expect(stripItemKindTitlePrefix("remind", remind)).toBe("Milk");
    expect(stripItemKindTitlePrefix("expires", expires)).toBe("Milk");
    expect(stripItemKindTitlePrefix("purchased", purchased)).toBe("Milk");
  });

  it("prefers item emoji over category emoji, else clear fallback", () => {
    expect(resolveItemEmoji({ emoji: "🍎" }, { emoji: "📦" })).toBe("🍎");
    expect(resolveItemEmoji({ emoji: null }, { emoji: "🍎" })).toBe("🍎");
    expect(resolveItemEmoji({}, null)).toBe(DEFAULT_ITEM_EMOJI);
  });

  it("uses stored category emoji and synthetic card marks", () => {
    expect(resolveCategoryEmoji({ slug: "insurance", emoji: "☂️" })).toBe("☂️");
    expect(resolveCategoryEmoji({ slug: "food", emoji: "🍎" })).toBe("🍎");
    expect(resolveCategoryCardEmoji(ALL_CATEGORIES_ID, null)).toBe(ALL_CATEGORIES_EMOJI);
    expect(resolveCategoryCardEmoji(UNCATEGORIZED_CATEGORY_ID, null)).toBe(
      UNCATEGORIZED_EMOJI,
    );
    expect(resolveCategoryCardEmoji("c1", { emoji: null })).toBe(DEFAULT_ITEM_EMOJI);
  });

  it("keeps resolveCategoryEmoji aligned with DDL seed glyphs (no FE overlay)", () => {
    for (const [slug, emoji] of Object.entries(DDL_SEED_CATEGORY_EMOJIS)) {
      expect(resolveCategoryEmoji({ slug, emoji })).toBe(emoji);
    }
    // Without overlay, stored legacy glyphs pass through as-is (wipe resets seeds).
    expect(resolveCategoryEmoji({ slug: "insurance", emoji: "📋" })).toBe("📋");

    const seedGlyphs = new Set(Object.values(DDL_SEED_CATEGORY_EMOJIS));
    expect(seedGlyphs.has(ALL_CATEGORIES_EMOJI)).toBe(false);
    expect(seedGlyphs.has(UNCATEGORIZED_EMOJI)).toBe(false);
    expect(DEFAULT_ITEM_EMOJI).toBe(DDL_SEED_CATEGORY_EMOJIS.other);
  });

  it("labels distinguish remind vs expires", () => {
    expect(itemDateKindLabel("remind")).toBe(String(i18n.t("items:remindPrefix")));
    expect(itemDateKindLabel("expires")).toBe(String(i18n.t("items:expiresPrefix")));
  });

  it("maps item date kinds to tiny calendar glyphs", () => {
    expect(itemDateKindEmoji("purchased")).toBe(ITEM_DATE_KIND_EMOJI.purchased);
    expect(itemDateKindEmoji("remind")).toBe(ITEM_DATE_KIND_EMOJI.remind);
    expect(itemDateKindEmoji("expires")).toBe(ITEM_DATE_KIND_EMOJI.expires);
    expect(itemDateKindEmoji("purchased")).toBe("🛒");
    expect(itemDateKindMarkerClass("purchased")).toContain("text-[8px]");
    expect(itemDateKindMarkerClass("purchased")).not.toContain("rounded-full");
  });
});

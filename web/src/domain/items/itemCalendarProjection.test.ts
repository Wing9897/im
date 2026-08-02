import { beforeEach, describe, expect, it } from "vitest";

import i18n from "../../i18n";
import { setAppLocale } from "../../i18n/locale";
import {
  ALL_CATEGORIES_EMOJI,
  DEFAULT_ITEM_EMOJI,
  UNCATEGORIZED_EMOJI,
  formatItemOccurrenceTitle,
  itemDateKindBadgeTone,
  itemDateKindLabel,
  itemOccurrenceId,
  resolveCategoryCardEmoji,
  resolveCategoryEmoji,
  resolveItemEmoji,
} from "./itemCalendarProjection";
import { ALL_CATEGORIES_ID, UNCATEGORIZED_CATEGORY_ID } from "./categoryAggregates";

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

  it("prefers item emoji over category emoji, else clear fallback", () => {
    expect(resolveItemEmoji({ emoji: "🍎" }, { emoji: "📦" })).toBe("🍎");
    expect(resolveItemEmoji({ emoji: null }, { emoji: "🍎" })).toBe("🍎");
    expect(resolveItemEmoji({}, null)).toBe(DEFAULT_ITEM_EMOJI);
  });

  it("applies seed emoji overlay and synthetic card marks", () => {
    expect(resolveCategoryEmoji({ slug: "insurance", emoji: "📋" })).toBe("☂️");
    expect(resolveCategoryEmoji({ slug: "food", emoji: "🍎" })).toBe("🍎");
    expect(resolveCategoryCardEmoji(ALL_CATEGORIES_ID, null)).toBe(ALL_CATEGORIES_EMOJI);
    expect(resolveCategoryCardEmoji(UNCATEGORIZED_CATEGORY_ID, null)).toBe(
      UNCATEGORIZED_EMOJI,
    );
    expect(resolveCategoryCardEmoji("c1", { emoji: null })).toBe(DEFAULT_ITEM_EMOJI);
  });

  it("labels and tones distinguish remind vs expires", () => {
    expect(itemDateKindLabel("remind")).toBe(String(i18n.t("items:remindPrefix")));
    expect(itemDateKindLabel("expires")).toBe(String(i18n.t("items:expiresPrefix")));
    expect(itemDateKindBadgeTone("remind")).toBe("warning");
    expect(itemDateKindBadgeTone("expires")).toBe("danger");
  });
});

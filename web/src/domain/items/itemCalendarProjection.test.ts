import { beforeEach, describe, expect, it } from "vitest";

import i18n from "../../i18n";
import { setAppLocale } from "../../i18n/locale";
import {
  formatItemOccurrenceTitle,
  itemOccurrenceId,
  resolveItemEmoji,
} from "./itemCalendarProjection";

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

  it("prefers item emoji over category emoji", () => {
    expect(resolveItemEmoji({ emoji: "🍎" }, { emoji: "📦" })).toBe("🍎");
    expect(resolveItemEmoji({ emoji: null }, { emoji: "📦" })).toBe("📦");
    expect(resolveItemEmoji({}, null)).toBeNull();
  });
});

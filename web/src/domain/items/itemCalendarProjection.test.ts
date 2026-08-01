import { beforeEach, describe, expect, it } from "vitest";

import i18n from "../../i18n";
import { setAppLocale } from "../../i18n/locale";
import {
  formatItemOccurrenceTitle,
  itemOccurrenceId,
} from "./itemCalendarProjection";

describe("itemCalendarProjection helpers", () => {
  beforeEach(async () => {
    await setAppLocale("zh-Hant");
  });

  it("builds stable occurrence ids", () => {
    expect(itemOccurrenceId("abc", "purchased")).toBe("item:abc:purchased");
    expect(itemOccurrenceId("abc", "expires")).toBe("item:abc:expires");
  });

  it("formats titles with i18n prefixes (not hardcoded 購入)", () => {
    expect(formatItemOccurrenceTitle("purchased", "Milk")).toBe(
      `${String(i18n.t("items:purchasedPrefix"))} · Milk`,
    );
    expect(formatItemOccurrenceTitle("expires", "Milk")).toBe(
      `${String(i18n.t("items:expiresPrefix"))} · Milk`,
    );
  });
});

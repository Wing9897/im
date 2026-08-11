import { describe, expect, it } from "vitest";

import {
  isExpiresCalendarEvent,
  isPurchaseEffectiveCalendarEvent,
  normalizeUserEventCalendarKind,
  quickKindToCalendarKind,
} from "./userEventCalendarKind";

describe("userEventCalendarKind", () => {
  it("treats kind as authority over title presets", () => {
    expect(isExpiresCalendarEvent({ kind: "expires", title: "保修到期" })).toBe(true);
    expect(isExpiresCalendarEvent({ kind: "expires", title: "Anything" })).toBe(true);
    expect(isExpiresCalendarEvent({ kind: "normal", title: "到期" })).toBe(false);
    expect(isExpiresCalendarEvent({ kind: "purchase_effective", title: "到期" })).toBe(false);

    expect(
      isPurchaseEffectiveCalendarEvent({ kind: "purchase_effective", title: "双十一相机" }),
    ).toBe(true);
    expect(isPurchaseEffectiveCalendarEvent({ kind: "normal", title: "購入" })).toBe(false);
    expect(isPurchaseEffectiveCalendarEvent({ kind: "expires", title: "Purchased" })).toBe(false);
  });

  it("falls back to title presets only when kind is missing", () => {
    expect(isExpiresCalendarEvent({ title: "到期" })).toBe(true);
    expect(isExpiresCalendarEvent({ kind: "", title: "Expires" })).toBe(true);
    expect(isPurchaseEffectiveCalendarEvent({ title: "購入" })).toBe(true);
    expect(isPurchaseEffectiveCalendarEvent({ kind: null, title: "Effective" })).toBe(true);
  });

  it("maps quick presets and normalizes wire kinds", () => {
    expect(quickKindToCalendarKind("expires")).toBe("expires");
    expect(quickKindToCalendarKind("purchaseEffective")).toBe("purchase_effective");
    expect(quickKindToCalendarKind("other")).toBe("normal");
    expect(normalizeUserEventCalendarKind("expires")).toBe("expires");
    expect(normalizeUserEventCalendarKind("bogus")).toBe("normal");
  });
});

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

  it("does not infer kind from title presets", () => {
    expect(isExpiresCalendarEvent({ kind: undefined })).toBe(false);
    expect(isExpiresCalendarEvent({ kind: "" })).toBe(false);
    expect(isExpiresCalendarEvent({ kind: null })).toBe(false);
    expect(isPurchaseEffectiveCalendarEvent({ kind: undefined })).toBe(false);
    expect(isPurchaseEffectiveCalendarEvent({ kind: null })).toBe(false);
  });

  it("maps quick presets and normalizes wire kinds", () => {
    expect(quickKindToCalendarKind("expires")).toBe("expires");
    expect(quickKindToCalendarKind("purchaseEffective")).toBe("purchase_effective");
    expect(quickKindToCalendarKind("other")).toBe("normal");
    expect(normalizeUserEventCalendarKind("expires")).toBe("expires");
    expect(normalizeUserEventCalendarKind("bogus")).toBe("normal");
  });
});

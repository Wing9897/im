import { describe, expect, it } from "vitest";
import {
  daysUntil,
  expiryTone,
  expiryToneAccentClass,
  expiryToneBadgeTone,
  itemsEmptyKind,
} from "./itemExpiryTone";

describe("daysUntil / expiryTone", () => {
  it("computes remaining days and tones", () => {
    const today = new Date(2026, 7, 2); // Aug 2 local
    expect(daysUntil("2026-08-05", today)).toBe(3);
    expect(expiryTone(3, 7)).toBe("soon");
    expect(expiryTone(-1)).toBe("overdue");
    expect(expiryTone(30, 7)).toBe("ok");
    expect(expiryTone(null)).toBe("none");
  });

  it("uses remindBeforeDays as the soon window (null means no soon)", () => {
    expect(expiryTone(10, 14)).toBe("soon");
    expect(expiryTone(20, 14)).toBe("ok");
    expect(expiryTone(5, 3)).toBe("ok");
    expect(expiryTone(3, 3)).toBe("soon");
    expect(expiryTone(8, null)).toBe("ok");
    expect(expiryTone(7, undefined)).toBe("ok");
    expect(expiryTone(0, null)).toBe("ok");
    expect(expiryTone(0, 0)).toBe("ok");
  });

  it("maps expiry tones to shared accent / badge tokens", () => {
    expect(expiryToneAccentClass("overdue")).toBe("bg-error");
    expect(expiryToneAccentClass("soon")).toBe("bg-warning");
    expect(expiryToneAccentClass("ok")).toBe("bg-success");
    expect(expiryToneAccentClass("none")).toBe("bg-text-muted");
    expect(expiryToneBadgeTone("overdue")).toBe("danger");
    expect(expiryToneBadgeTone("soon")).toBe("warning");
    expect(expiryToneBadgeTone("ok")).toBe("success");
    expect(expiryToneBadgeTone("none")).toBe("neutral");
  });
});

describe("itemsEmptyKind", () => {
  it("splits true-empty vs filter-empty", () => {
    expect(itemsEmptyKind({ totalCount: 0, filteredCount: 0 })).toBe("true-empty");
    expect(itemsEmptyKind({ totalCount: 4, filteredCount: 0 })).toBe("filtered-empty");
    expect(itemsEmptyKind({ totalCount: 4, filteredCount: 2 })).toBe("none");
  });
});

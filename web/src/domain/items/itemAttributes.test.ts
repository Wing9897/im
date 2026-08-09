import { describe, expect, it } from "vitest";
import {
  daysUntil,
  expiryTone,
  expiryToneAccentClass,
  expiryToneBadgeTone,
  findReservedAttributeKeys,
  isReservedAttributeKey,
  itemsEmptyKind,
  partitionItemAttributes,
  resolveRemindOnCategoryChange,
  seedAttributesFromFieldSchema,
} from "./itemAttributes";

describe("seedAttributesFromFieldSchema", () => {
  it("adds missing category preset keys as empty strings", () => {
    expect(
      seedAttributesFromFieldSchema(
        { id_number: "A123" },
        [
          { key: "id_number", label: "證件號碼" },
          { key: "issuer", label: "簽發機關" },
        ],
      ),
    ).toEqual({ id_number: "A123", issuer: "" });
  });

  it("does not overwrite existing keys", () => {
    expect(
      seedAttributesFromFieldSchema(
        { issuer: "Gov" },
        [{ key: "issuer", label: "簽發機關" }],
      ),
    ).toEqual({ issuer: "Gov" });
  });

  it("skips reserved expiry keys from category presets", () => {
    expect(
      seedAttributesFromFieldSchema({}, [{ key: "到期", label: "到期" }, { key: "id", label: "ID" }]),
    ).toEqual({ id: "" });
  });
});

describe("reserved attribute keys", () => {
  it("detects linked-calendar expiry titles", () => {
    expect(isReservedAttributeKey("到期")).toBe(true);
    expect(isReservedAttributeKey(" Expires ")).toBe(true);
    expect(isReservedAttributeKey("expiry_note")).toBe(false);
  });

  it("finds reserved keys in a list", () => {
    expect(findReservedAttributeKeys(["id", "到期", "brand"])).toEqual(["到期"]);
  });
});

describe("partitionItemAttributes", () => {
  it("keeps non-schema filled keys in other", () => {
    const parts = partitionItemAttributes(
      { id_number: "A123", custom: "keep-me", emptyish: "" },
      [{ key: "id_number", label: "證件號碼" }],
    );
    expect(parts.suggested).toEqual([{ key: "id_number", label: "證件號碼", value: "A123" }]);
    expect(parts.other).toEqual([{ key: "custom", value: "keep-me" }]);
  });

  it("shows empty suggested slots without deleting extras", () => {
    const parts = partitionItemAttributes(
      { leftover: "x" },
      [
        { key: "id_number", label: "證件號碼" },
        { key: "issuer", label: "簽發機關" },
      ],
    );
    expect(parts.suggested).toHaveLength(2);
    expect(parts.suggested[0]?.value).toBe("");
    expect(parts.other).toEqual([{ key: "leftover", value: "x" }]);
  });
});

describe("resolveRemindOnCategoryChange", () => {
  it("does not overwrite an existing remind value", () => {
    expect(
      resolveRemindOnCategoryChange({ currentRemind: 14, categoryDefault: 90 }),
    ).toBe(14);
  });

  it("applies category default when remind is empty", () => {
    expect(
      resolveRemindOnCategoryChange({ currentRemind: null, categoryDefault: 90 }),
    ).toBe(90);
  });
});

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

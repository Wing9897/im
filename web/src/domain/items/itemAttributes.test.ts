import { describe, expect, it } from "vitest";
import {
  daysUntil,
  expiryTone,
  partitionItemAttributes,
  resolveRemindOnCategoryChange,
} from "./itemAttributes";

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
    expect(expiryTone(3)).toBe("soon");
    expect(expiryTone(-1)).toBe("overdue");
    expect(expiryTone(30)).toBe("ok");
    expect(expiryTone(null)).toBe("none");
  });
});

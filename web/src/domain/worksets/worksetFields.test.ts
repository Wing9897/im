import { describe, expect, it } from "vitest";

import {
  graphemeCount,
  isValidWorksetEmoji,
  normalizeWorksetDescription,
  WORKSET_DESCRIPTION_MAX,
} from "./worksetFields";

describe("worksetFields", () => {
  it("counts a ZWJ family emoji as one grapheme", () => {
    expect(graphemeCount("👨‍👩‍👧‍👦")).toBe(1);
    expect(isValidWorksetEmoji("👨‍👩‍👧‍👦")).toBe(true);
    expect(isValidWorksetEmoji("😀😀")).toBe(false);
    expect(isValidWorksetEmoji("")).toBe(true);
  });

  it("trims description and keeps the 280 cap as a constant", () => {
    expect(normalizeWorksetDescription("  hello  ")).toBe("hello");
    expect(WORKSET_DESCRIPTION_MAX).toBe(280);
  });
});

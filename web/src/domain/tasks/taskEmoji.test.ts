import { describe, expect, it } from "vitest";

import { lookupTaskEmoji, lookupTaskEmojiForEvent } from "./taskEmoji";

describe("taskEmoji lookup", () => {
  it("returns the trimmed glyph", () => {
    expect(lookupTaskEmoji("🎯")).toBe("🎯");
    expect(lookupTaskEmoji(" 📌 ")).toBe("📌");
  });

  it("treats empty / missing as default logo (empty glyph)", () => {
    expect(lookupTaskEmoji(undefined)).toBe("");
    expect(lookupTaskEmoji(null)).toBe("");
    expect(lookupTaskEmoji("")).toBe("");
    expect(lookupTaskEmoji("   ")).toBe("");
  });

  it("reads timeline rows from event.emoji", () => {
    expect(lookupTaskEmojiForEvent({ emoji: "🎯" })).toBe("🎯");
    expect(lookupTaskEmojiForEvent({ emoji: null })).toBe("");
  });
});

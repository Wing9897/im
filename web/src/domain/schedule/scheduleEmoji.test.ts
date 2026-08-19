import { describe, expect, it } from "vitest";

import { lookupScheduleEmoji } from "./scheduleEmoji";

describe("scheduleEmoji lookup", () => {
  it("reads the glyph from the entity for user / recurring rows", () => {
    expect(lookupScheduleEmoji({ source: "user", emoji: "🎂" })).toBe("🎂");
    expect(lookupScheduleEmoji({ source: "recurring", emoji: " 🔁 " })).toBe("🔁");
  });

  it("returns empty for analysis / item_remind / missing glyphs", () => {
    expect(lookupScheduleEmoji({ source: "analysis", emoji: "🎯" })).toBe("");
    expect(lookupScheduleEmoji({ source: "item_remind", emoji: "📦" })).toBe("");
    expect(lookupScheduleEmoji({ source: "user", emoji: null })).toBe("");
    expect(lookupScheduleEmoji({ source: "recurring" })).toBe("");
  });
});

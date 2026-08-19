import { describe, expect, it } from "vitest";

import { lookupTaskEmoji, lookupTaskEmojiForEvent } from "./taskEmoji";

describe("taskEmoji lookup", () => {
  it("returns the trimmed glyph for a task id", () => {
    expect(lookupTaskEmoji({ "task-1": "🎯", "task-2": " 📌 " }, "task-1")).toBe("🎯");
    expect(lookupTaskEmoji({ "task-2": " 📌 " }, "task-2")).toBe("📌");
  });

  it("treats empty / missing / __general__ as default logo (empty glyph)", () => {
    expect(lookupTaskEmoji({}, "task-1")).toBe("");
    expect(lookupTaskEmoji({ "task-1": "🎯" }, "")).toBe("");
    expect(lookupTaskEmoji({ "task-1": "🎯" }, null)).toBe("");
    expect(lookupTaskEmoji({ __general__: "❌" }, "__general__")).toBe("");
  });

  it("looks up timeline rows via taskId", () => {
    const emojis = { "task-ops": "🎯" };
    expect(lookupTaskEmojiForEvent(emojis, { taskId: "task-ops" })).toBe("🎯");
    expect(lookupTaskEmojiForEvent(emojis, { taskId: "other" })).toBe("");
  });
});

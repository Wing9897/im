import { describe, it, expect } from "vitest";
import { parseTaskAssistantResponse } from "./parseTaskAssistantResponse";

// ============================================================
// Helper: build a valid response for testing
// ============================================================

function validResponse(overrides?: Record<string, unknown>) {
  return {
    message: "已為你設定任務",
    taskConfig: {
      name: "熱門話題追蹤",
      promptTemplate: "分析以下訊息的熱門話題",
      scheduleType: "hourly",
      analysisMode: "leaderboard",
      channelIds: ["ch-1", "ch-2"],
      ...overrides,
    },
  };
}

// ============================================================
// Tests
// ============================================================

describe("parseTaskAssistantResponse", () => {
  describe("valid responses — complete config", () => {
    it("parses a complete valid response with all required fields", () => {
      const result = parseTaskAssistantResponse(validResponse());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.message).toBe("已為你設定任務");
        expect(result.data.taskConfig.name).toBe("熱門話題追蹤");
        expect(result.data.taskConfig.promptTemplate).toBe("分析以下訊息的熱門話題");
        expect(result.data.taskConfig.scheduleType).toBe("hourly");
        expect(result.data.taskConfig.analysisMode).toBe("leaderboard");
        expect(result.data.taskConfig.channelIds).toEqual(["ch-1", "ch-2"]);
      }
    });

    it("includes optional fields when present", () => {
      const result = parseTaskAssistantResponse(
        validResponse({
          description: "追蹤群組熱門話題",
          analysisTimeRange: "48h",
          scheduleValue: "14:30",
          includeInTimeline: false,
        }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.taskConfig.description).toBe("追蹤群組熱門話題");
        expect(result.data.taskConfig.analysisTimeRange).toBe("48h");
        expect(result.data.taskConfig.scheduleValue).toBe("14:30");
        expect(result.data.taskConfig.includeInTimeline).toBe(false);
      }
    });

    it("parses includeInTimeline true and false", () => {
      for (const includeInTimeline of [true, false]) {
        const result = parseTaskAssistantResponse(validResponse({ includeInTimeline }));
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.data.taskConfig.includeInTimeline).toBe(includeInTimeline);
        }
      }
    });

    it("rejects non-boolean includeInTimeline", () => {
      const result = parseTaskAssistantResponse(validResponse({ includeInTimeline: "yes" }));
      expect(result.ok).toBe(false);
    });

    it("handles missing optional fields gracefully (they are undefined)", () => {
      const result = parseTaskAssistantResponse(validResponse());
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.taskConfig.description).toBeUndefined();
        expect(result.data.taskConfig.analysisTimeRange).toBeUndefined();
      }
    });

    it("handles null scheduleValue", () => {
      const result = parseTaskAssistantResponse(validResponse({ scheduleValue: null }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.taskConfig.scheduleValue).toBeNull();
      }
    });

    it("trims whitespace from name and promptTemplate", () => {
      const result = parseTaskAssistantResponse(
        validResponse({ name: "  test  ", promptTemplate: "  prompt  " }),
      );
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.taskConfig.name).toBe("test");
        expect(result.data.taskConfig.promptTemplate).toBe("prompt");
      }
    });

    it("accepts all valid schedule types", () => {
      const types = ["seconds_10", "hourly", "daily", "weekly", "custom_seconds"];
      for (const scheduleType of types) {
        const result = parseTaskAssistantResponse(validResponse({ scheduleType }));
        expect(result.ok).toBe(true);
      }
    });

    it("accepts all valid analysis modes", () => {
      const modes = ["leaderboard", "event", "recurring", "calendar_task", "project"];
      for (const analysisMode of modes) {
        const result = parseTaskAssistantResponse(validResponse({ analysisMode }));
        expect(result.ok).toBe(true);
      }
    });
  });

  describe("structural errors — top-level validation", () => {
    it("rejects null", () => {
      const result = parseTaskAssistantResponse(null);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("不是有效的物件");
    });

    it("rejects undefined", () => {
      const result = parseTaskAssistantResponse(undefined);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("不是有效的物件");
    });

    it("rejects a string", () => {
      const result = parseTaskAssistantResponse("hello");
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("不是有效的物件");
    });

    it("rejects missing message", () => {
      const result = parseTaskAssistantResponse({ taskConfig: {} });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("message");
    });

    it("rejects non-string message", () => {
      const result = parseTaskAssistantResponse({ message: 123, taskConfig: {} });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("message 必須是字串");
    });

    it("rejects array taskConfig", () => {
      const result = parseTaskAssistantResponse({ message: "hi", taskConfig: [] });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("taskConfig 必須是物件");
    });

    it("rejects non-string name type (number)", () => {
      const result = parseTaskAssistantResponse(validResponse({ name: 42 }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("name 必須是非空字串");
    });

    it("rejects non-string promptTemplate type (array)", () => {
      const result = parseTaskAssistantResponse(validResponse({ promptTemplate: ["a"] }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("promptTemplate 必須是非空字串");
    });

    it("rejects non-string scheduleType type (number)", () => {
      const result = parseTaskAssistantResponse(validResponse({ scheduleType: 123 }));
      expect(result.ok).toBe(false);
    });

    it("rejects non-string analysisMode type (boolean)", () => {
      const result = parseTaskAssistantResponse(validResponse({ analysisMode: true }));
      expect(result.ok).toBe(false);
    });

    it("rejects non-array channelIds (string)", () => {
      const result = parseTaskAssistantResponse(validResponse({ channelIds: "ch-1" }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error).toContain("channelIds 必須是陣列");
    });
  });

  describe("incremental parsing — conversation-only turns", () => {
    it("accepts missing taskConfig as conversation-only (returns empty config)", () => {
      const result = parseTaskAssistantResponse({ message: "請告訴我更多資訊" });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.message).toBe("請告訴我更多資訊");
        expect(result.data.taskConfig).toEqual({});
      }
    });

    it("accepts empty taskConfig as conversation-only", () => {
      const result = parseTaskAssistantResponse({ message: "ok", taskConfig: {} });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.taskConfig).toEqual({});
      }
    });

    it("skips empty-string name gracefully (not an error)", () => {
      const result = parseTaskAssistantResponse(validResponse({ name: "   " }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        // name is omitted from the partial config (empty = AI hasn't decided)
        expect(result.data.taskConfig.name).toBeUndefined();
        // other fields still present
        expect(result.data.taskConfig.promptTemplate).toBe("分析以下訊息的熱門話題");
      }
    });

    it("skips invalid scheduleType silently (graceful degradation)", () => {
      const result = parseTaskAssistantResponse(validResponse({ scheduleType: "every_minute" }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        // Invalid enum value is simply not included
        expect(result.data.taskConfig.scheduleType).toBeUndefined();
        // Other valid fields are still returned
        expect(result.data.taskConfig.name).toBe("熱門話題追蹤");
      }
    });

    it("skips invalid analysisMode silently", () => {
      const result = parseTaskAssistantResponse(validResponse({ analysisMode: "chart" }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.taskConfig.analysisMode).toBeUndefined();
      }
    });

    it("filters non-string elements from channelIds silently", () => {
      const result = parseTaskAssistantResponse(validResponse({ channelIds: ["ch-1", 42, "ch-2", null] }));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.taskConfig.channelIds).toEqual(["ch-1", "ch-2"]);
      }
    });

    it("returns partial config when only some fields are populated", () => {
      const result = parseTaskAssistantResponse({
        message: "已設定名稱",
        taskConfig: { name: "BTC 追蹤" },
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.taskConfig.name).toBe("BTC 追蹤");
        expect(result.data.taskConfig.promptTemplate).toBeUndefined();
        expect(result.data.taskConfig.channelIds).toBeUndefined();
      }
    });
  });

  describe("graceful handling of invalid optional fields", () => {
    it("ignores non-string description", () => {
      const result = parseTaskAssistantResponse(validResponse({ description: 123 }));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.taskConfig.description).toBeUndefined();
    });

    it("ignores empty analysisTimeRange", () => {
      const result = parseTaskAssistantResponse(validResponse({ analysisTimeRange: "  " }));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.taskConfig.analysisTimeRange).toBeUndefined();
    });

    it("ignores non-string scheduleValue", () => {
      const result = parseTaskAssistantResponse(validResponse({ scheduleValue: 123 }));
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.data.taskConfig.scheduleValue).toBeUndefined();
    });
  });
});

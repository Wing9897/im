import { describe, expect, it } from "vitest";
import { parseTriggerConditions } from "./parseTriggerConditions";

describe("parseTriggerConditions", () => {
  it("returns empty object for null", () => {
    expect(parseTriggerConditions(null)).toEqual({});
  });

  it("returns empty object for invalid JSON", () => {
    expect(parseTriggerConditions("not-json")).toEqual({});
  });

  it("parses score_threshold and task_id", () => {
    const result = parseTriggerConditions(
      JSON.stringify({ score_threshold: 80, task_id: "t1" }),
    );
    expect(result).toEqual({ score_threshold: 80, task_id: "t1" });
  });
});

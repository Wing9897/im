import { describe, expect, it } from "vitest";

import { isScheduleOnlyAnalysisMode } from "./useTaskScheduleRelatedEvents";

describe("isScheduleOnlyAnalysisMode", () => {
  it("matches recurring and calendar_task only", () => {
    expect(isScheduleOnlyAnalysisMode("recurring")).toBe(true);
    expect(isScheduleOnlyAnalysisMode("calendar_task")).toBe(true);
    expect(isScheduleOnlyAnalysisMode("project")).toBe(false);
    expect(isScheduleOnlyAnalysisMode("event")).toBe(false);
    expect(isScheduleOnlyAnalysisMode("leaderboard")).toBe(false);
  });
});

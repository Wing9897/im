import { describe, expect, it } from "vitest";

import {
  isUserScheduleTimelineEvent,
  scheduleCardText,
} from "./scheduleCardFields";

describe("scheduleCardFields", () => {
  it("scheduleCardText uses empty token for blank / whitespace / legacy N/A", () => {
    expect(scheduleCardText(null, "N/A")).toBe("N/A");
    expect(scheduleCardText(undefined, "N/A")).toBe("N/A");
    expect(scheduleCardText("  ", "N/A")).toBe("N/A");
    expect(scheduleCardText("n/a", "N/A")).toBe("N/A");
    expect(scheduleCardText("N/A", "N/A")).toBe("N/A");
    expect(scheduleCardText(" 台北 ", "N/A")).toBe("台北");
  });

  it("isUserScheduleTimelineEvent matches user_events and recurring series", () => {
    expect(isUserScheduleTimelineEvent("user")).toBe(true);
    expect(isUserScheduleTimelineEvent("recurring")).toBe(true);
    expect(isUserScheduleTimelineEvent("analysis")).toBe(false);
    expect(isUserScheduleTimelineEvent("item_remind")).toBe(false);
    expect(isUserScheduleTimelineEvent(undefined)).toBe(false);
  });
});

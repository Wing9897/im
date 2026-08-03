import { describe, expect, it } from "vitest";

import {
  ANALYSIS_EVENTS_MODES,
  ANALYSIS_MODE_CAPABILITIES,
  ANALYSIS_MODE_ORDER,
  analysisModeShowsWebSearchQuery,
  isAnalysisEventsMode,
  isTimelineAssignableAnalysisMode,
} from "./analysisModeCapabilities";

describe("analysisModeCapabilities — web_intel / finding modes", () => {
  it("orders web_intel among the five product modes", () => {
    expect(ANALYSIS_MODE_ORDER).toEqual([
      "leaderboard",
      "event",
      "web_intel",
      "recurring",
      "project",
    ]);
  });

  it("treats event + web_intel as analysis_events (Intelligence / Timeline / Board)", () => {
    expect(ANALYSIS_EVENTS_MODES).toEqual(["event", "web_intel"]);
    expect(isAnalysisEventsMode("event")).toBe(true);
    expect(isAnalysisEventsMode("web_intel")).toBe(true);
    expect(isAnalysisEventsMode("leaderboard")).toBe(false);
    expect(isAnalysisEventsMode("recurring")).toBe(false);
  });

  it("marks web_intel as AI + schedulable + timeline-owning without message batches", () => {
    expect(ANALYSIS_MODE_CAPABILITIES.web_intel).toEqual({
      ai: true,
      schedulable: true,
      messageBatch: false,
      timelineOwning: true,
      pipeline: "web_intel_tick",
    });
    expect(analysisModeShowsWebSearchQuery("web_intel")).toBe(true);
    expect(isTimelineAssignableAnalysisMode("web_intel")).toBe(true);
  });
});

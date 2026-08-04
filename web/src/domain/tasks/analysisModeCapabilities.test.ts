import { describe, expect, it } from "vitest";

import {
  ANALYSIS_EVENTS_MODES,
  ANALYSIS_MODE_CAPABILITIES,
  ANALYSIS_MODE_ORDER,
  analysisModeIsWebIntel,
  analysisModeRequiresChannels,
  analysisModeShowsOptionalChannels,
  isAnalysisEventsMode,
  isTimelineAssignableAnalysisMode,
  webIntelMessageGateActive,
} from "./analysisModeCapabilities";

describe("analysisModeCapabilities — web_intel / finding modes", () => {
  it("orders web_intel among the five product modes", () => {
    expect(ANALYSIS_MODE_ORDER).toEqual([
      "leaderboard",
      "intel_event",
      "web_intel",
      "recurring",
      "project",
    ]);
  });

  it("treats intel_event + web_intel as analysis_events (Intelligence / Timeline / Board)", () => {
    expect(ANALYSIS_EVENTS_MODES).toEqual(["intel_event", "web_intel"]);
    expect(isAnalysisEventsMode("intel_event")).toBe(true);
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
    expect(analysisModeIsWebIntel("web_intel")).toBe(true);
    expect(analysisModeRequiresChannels("web_intel")).toBe(false);
    expect(analysisModeShowsOptionalChannels("web_intel")).toBe(true);
    expect(isTimelineAssignableAnalysisMode("web_intel")).toBe(true);
  });

  it("treats bound channels as web_intel message-gate without flipping messageBatch", () => {
    expect(webIntelMessageGateActive("web_intel", [])).toBe(false);
    expect(webIntelMessageGateActive("web_intel", ["ch-1"])).toBe(true);
    expect(webIntelMessageGateActive("intel_event", ["ch-1"])).toBe(false);
  });
});

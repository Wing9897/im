import { describe, expect, it } from "vitest";

import {
  ANALYSIS_EVENTS_MODES,
  ANALYSIS_MODE_CAPABILITIES,
  ANALYSIS_MODE_ORDER,
  analysisModeIsAgent,
  analysisModeRequiresChannels,
  analysisModeShowsOptionalChannels,
  isAnalysisEventsMode,
  isTimelineAssignableAnalysisMode,
  taskWritesAnalysisEvents,
} from "./analysisModeCapabilities";

describe("analysisModeCapabilities — agent / finding modes", () => {
  it("orders the three analysis modes", () => {
    expect(ANALYSIS_MODE_ORDER).toEqual([
      "leaderboard",
      "intel_event",
      "agent",
    ]);
  });

  it("treats intel_event + agent as analysis_events (Intelligence / Timeline / Board)", () => {
    expect(ANALYSIS_EVENTS_MODES).toEqual(["intel_event", "agent"]);
    expect(isAnalysisEventsMode("intel_event")).toBe(true);
    expect(isAnalysisEventsMode("agent")).toBe(true);
    expect(isAnalysisEventsMode("leaderboard")).toBe(false);
    expect(isAnalysisEventsMode("recurring")).toBe(false);
  });

  it("marks agent as AI + schedulable + timeline-owning without message batches", () => {
    expect(ANALYSIS_MODE_CAPABILITIES.agent).toEqual({
      ai: true,
      schedulable: true,
      messageBatch: false,
      timelineOwning: true,
      pipeline: "agent_tick",
    });
    expect(analysisModeIsAgent("agent")).toBe(true);
    expect(analysisModeRequiresChannels("agent")).toBe(false);
    expect(analysisModeShowsOptionalChannels("agent")).toBe(true);
    expect(isTimelineAssignableAnalysisMode("agent")).toBe(true);
  });

  it("gates intelligence refresh on agent outputAnalysisEvents", () => {
    expect(taskWritesAnalysisEvents({ analysisMode: "intel_event" })).toBe(true);
    expect(
      taskWritesAnalysisEvents({ analysisMode: "agent", outputAnalysisEvents: true }),
    ).toBe(true);
    expect(
      taskWritesAnalysisEvents({ analysisMode: "agent", outputAnalysisEvents: false }),
    ).toBe(false);
  });
});

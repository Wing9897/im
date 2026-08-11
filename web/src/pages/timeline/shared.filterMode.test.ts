import { describe, expect, it } from "vitest";

import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { resolveTimelineFilterPlan } from "../../domain/timeline/timelineFilterPlan";

describe("resolveTimelineFilterPlan", () => {
  const tasks = [
    { id: "evt-1", analysisMode: "intel_event", worksetId: "ws-a" },
    { id: "web-1", analysisMode: "agent", outputAnalysisEvents: true, worksetId: "ws-a" },
    { id: "lb-1", analysisMode: "leaderboard", worksetId: "ws-a" },
  ];

  it("resolves hierarchical multi-select plans", () => {
    expect(resolveTimelineFilterPlan(null, tasks)).toMatchObject({
      fetchAnalysis: true,
      fetchCalendar: true,
      fetchUserEvents: true,
      fetchItems: true,
      analysisTaskIds: null,
    });
    expect(resolveTimelineFilterPlan({ taskIds: [], worksetIds: [] }, tasks)).toMatchObject({
      fetchAnalysis: false,
      fetchCalendar: false,
      fetchUserEvents: false,
      fetchItems: false,
    });
    expect(
      resolveTimelineFilterPlan({ taskIds: ["evt-1"], worksetIds: [] }, tasks),
    ).toMatchObject({
      fetchAnalysis: true,
      fetchCalendar: false,
      fetchUserEvents: true,
      fetchItems: false,
      analysisTaskIds: ["evt-1"],
      seriesIds: [],
      selectedRealTaskIds: ["evt-1"],
    });
    expect(
      resolveTimelineFilterPlan({ taskIds: [], worksetIds: [SYSTEM_WORKSET_ID] }, tasks),
    ).toMatchObject({
      fetchAnalysis: false,
      fetchCalendar: true,
      fetchUserEvents: true,
      fetchItems: true,
      includeGeneralWorksetUserEvents: true,
      seriesIds: null,
    });
    expect(
      resolveTimelineFilterPlan({ taskIds: [], worksetIds: ["ws-a"] }, tasks),
    ).toMatchObject({
      fetchAnalysis: true,
      fetchItems: true,
      analysisTaskIds: expect.arrayContaining(["evt-1", "web-1"]),
      selectedRealTaskIds: expect.arrayContaining(["evt-1", "web-1", "lb-1"]),
      selectedWorksetIds: ["ws-a"],
    });
    expect(
      resolveTimelineFilterPlan({ taskIds: [], worksetIds: ["ws-a"] }, tasks).analysisTaskIds,
    ).not.toEqual(expect.arrayContaining(["lb-1"]));
  });

  it("treats explicit agent (analysis-out) selection as an analysis_events fetch", () => {
    expect(
      resolveTimelineFilterPlan({ taskIds: ["web-1"], worksetIds: [] }, tasks),
    ).toMatchObject({
      fetchAnalysis: true,
      fetchCalendar: false,
      fetchItems: false,
      analysisTaskIds: ["web-1"],
      seriesIds: [],
      selectedRealTaskIds: ["web-1"],
    });
  });
});

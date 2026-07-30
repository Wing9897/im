import { describe, expect, it } from "vitest";

import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { resolveTimelineFilterPlan } from "./shared";

describe("resolveTimelineFilterPlan", () => {
  const tasks = [
    { id: "evt-1", analysisMode: "event", worksetId: "ws-a" },
    { id: "cal-1", analysisMode: "recurring", worksetId: null },
    { id: "ct-1", analysisMode: "calendar_task", worksetId: null },
  ];

  it("resolves hierarchical multi-select plans", () => {
    expect(resolveTimelineFilterPlan(null, tasks)).toMatchObject({
      fetchAnalysis: true,
      fetchCalendar: true,
      fetchUserEvents: true,
      analysisTaskIds: null,
    });
    expect(resolveTimelineFilterPlan({ taskIds: [], worksetIds: [] }, tasks)).toMatchObject({
      fetchAnalysis: false,
      fetchCalendar: false,
      fetchUserEvents: false,
    });
    expect(
      resolveTimelineFilterPlan({ taskIds: ["evt-1", "cal-1"], worksetIds: [] }, tasks),
    ).toMatchObject({
      fetchAnalysis: true,
      fetchCalendar: true,
      fetchUserEvents: true,
      analysisTaskIds: ["evt-1"],
      recurringTaskIds: ["cal-1"],
      selectedRealTaskIds: ["evt-1", "cal-1"],
    });
    expect(
      resolveTimelineFilterPlan({ taskIds: [], worksetIds: [SYSTEM_WORKSET_ID] }, tasks),
    ).toMatchObject({
      fetchAnalysis: false,
      fetchCalendar: false,
      fetchUserEvents: true,
      includeGeneralWorksetUserEvents: true,
    });
    expect(
      resolveTimelineFilterPlan({ taskIds: [], worksetIds: ["ws-a"] }, tasks),
    ).toMatchObject({
      fetchAnalysis: true,
      analysisTaskIds: ["evt-1"],
      selectedRealTaskIds: ["evt-1"],
      selectedWorksetIds: ["ws-a"],
    });
  });
});

import { describe, expect, it } from "vitest";

import { USER_EVENTS_FILTER_ID } from "../../domain/timeline/userEvents";
import { resolveTimelineFilterPlan } from "./shared";

describe("resolveTimelineFilterPlan", () => {
  const tasks = [
    { id: "evt-1", analysisMode: "event" },
    { id: "cal-1", analysisMode: "recurring" },
    { id: "ct-1", analysisMode: "calendar_task" },
  ];

  it("resolves multi-select plans", () => {
    expect(resolveTimelineFilterPlan(null, tasks)).toMatchObject({
      fetchAnalysis: true,
      fetchCalendar: true,
      fetchUserEvents: true,
      analysisTaskIds: null,
    });
    expect(resolveTimelineFilterPlan([], tasks)).toMatchObject({
      fetchAnalysis: false,
      fetchCalendar: false,
      fetchUserEvents: false,
    });
    expect(resolveTimelineFilterPlan(["evt-1", "cal-1"], tasks)).toMatchObject({
      fetchAnalysis: true,
      fetchCalendar: true,
      fetchUserEvents: true,
      analysisTaskIds: ["evt-1"],
      calendarTaskIds: ["cal-1"],
      selectedRealTaskIds: ["evt-1", "cal-1"],
    });
    expect(resolveTimelineFilterPlan(null, tasks)).toMatchObject({
      calendarTaskIds: null,
    });
    expect(resolveTimelineFilterPlan([USER_EVENTS_FILTER_ID], tasks)).toMatchObject({
      fetchAnalysis: false,
      fetchCalendar: false,
      fetchUserEvents: true,
      includeUnassignedUserEvents: true,
    });
  });
});

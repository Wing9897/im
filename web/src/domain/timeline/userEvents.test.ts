import { describe, expect, it } from "vitest";

import {
  USER_EVENTS_FILTER_ID,
  filterAssignableTimelineTasks,
  isTimelineAssignableAnalysisMode,
  isUnassignedUserEventTaskId,
  resolveUserEventTaskName,
  toFilterTaskId,
  toUserEventFormTaskId,
  toUserEventWriteTaskId,
} from "./userEvents";

describe("userEvents helpers", () => {
  it("treats null/empty/__user__ as unassigned and normalizes to the sentinel", () => {
    expect(isUnassignedUserEventTaskId(null)).toBe(true);
    expect(isUnassignedUserEventTaskId("")).toBe(true);
    expect(isUnassignedUserEventTaskId(USER_EVENTS_FILTER_ID)).toBe(true);
    expect(isUnassignedUserEventTaskId("ct-1")).toBe(false);

    expect(toUserEventWriteTaskId(null)).toBe(USER_EVENTS_FILTER_ID);
    expect(toUserEventFormTaskId("")).toBe(USER_EVENTS_FILTER_ID);
    expect(toFilterTaskId("ct-1")).toBe("ct-1");
    expect(toUserEventFormTaskId).toBe(toUserEventWriteTaskId);
    expect(toFilterTaskId).toBe(toUserEventWriteTaskId);
  });

  it("filters assignable analysis modes and optional active-only", () => {
    expect(isTimelineAssignableAnalysisMode("calendar_task")).toBe(true);
    expect(isTimelineAssignableAnalysisMode("project")).toBe(true);
    expect(isTimelineAssignableAnalysisMode("summary")).toBe(false);

    const tasks = [
      { id: "a", name: "A", analysisMode: "event", isActive: true },
      { id: "b", name: "B", analysisMode: "calendar_task", isActive: false },
      { id: "c", name: "C", analysisMode: "summary", isActive: true },
      {
        id: "d",
        name: "Child",
        analysisMode: "recurring",
        isActive: true,
        parentTaskId: "proj-1",
      },
      { id: "e", name: "Project", analysisMode: "project", isActive: true },
    ];
    expect(filterAssignableTimelineTasks(tasks).map((t) => t.id)).toEqual(["a", "b", "e"]);
    expect(filterAssignableTimelineTasks(tasks, { activeOnly: true }).map((t) => t.id)).toEqual([
      "a",
      "e",
    ]);
  });

  it("resolves task display names with unassigned label fallback", () => {
    const map = new Map([["ct-1", "日曆任務"]]);
    expect(resolveUserEventTaskName(null)).toBeTruthy();
    expect(resolveUserEventTaskName("ct-1", map)).toBe("日曆任務");
    expect(resolveUserEventTaskName("missing", map)).toBe("missing");
    expect(resolveUserEventTaskName("ct-1", { "ct-1": "日曆任務" })).toBe("日曆任務");
  });
});

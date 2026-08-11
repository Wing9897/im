import { describe, expect, it } from "vitest";

import type { UserEvent } from "../../api/userEvents";
import { makeAnalysisTask } from "../../test/context-mocks";
import type { TaskActivitySpan } from "../../types/analysis";
import type { RecurringSeries } from "../../types/recurring";
import {
  findActivitySpan,
  isAgentCalendarTask,
  selectOwnedUserEvents,
  selectProjectChildren,
  selectTopLevelTasks,
} from "./agentTaskSelectors";

describe("agentTaskSelectors", () => {
  const project = makeAnalysisTask({
    id: "proj-1",
    name: "Launch",
    analysisMode: "agent",
    outputCalendar: true,
  });
  const child = {
    id: "child-1",
    name: "Standup",
    parentTaskId: "proj-1",
  } as RecurringSeries;
  const other = makeAnalysisTask({
    id: "event-1",
    name: "Watch",
    analysisMode: "intel_event",
  });
  const orphanChild = {
    id: "child-2",
    name: "Other standup",
    parentTaskId: "proj-2",
  } as RecurringSeries;

  it("detects project mode", () => {
    expect(isAgentCalendarTask(project)).toBe(true);
    expect(isAgentCalendarTask(null)).toBe(false);
  });

  it("selects only child recurring under the project", () => {
    expect(selectProjectChildren([child, orphanChild], "proj-1")).toEqual([child]);
  });

  it("returns the full analysis catalog (child series are not task rows)", () => {
    expect(selectTopLevelTasks([project, other])).toEqual([project, other]);
  });

  it("keeps child series under /calendar/recurring?parentTaskId= while catalog is analysis-only", () => {
    const catalog = [project, other];
    expect(catalog.map((task) => task.id)).toEqual([
      "proj-1",
      "event-1",
    ]);
    expect(selectTopLevelTasks(catalog).map((task) => task.id)).toEqual([
      "proj-1",
      "event-1",
    ]);
    expect(selectProjectChildren([child, orphanChild], "proj-1").map((task) => task.id)).toEqual([
      "child-1",
    ]);
    expect(selectProjectChildren([child, orphanChild], "proj-2").map((task) => task.id)).toEqual([
      "child-2",
    ]);
  });

  it("filters owned user events by taskId", () => {
    const events: UserEvent[] = [
      {
        id: "e1",
        title: "Kickoff",
        body: "",
        startTime: "2026-07-01T10:00:00Z",
        endTime: null,
        location: null,
        origin: "assistant",
        taskId: "proj-1",
        source: "user",
        createdAt: "2026-07-01T00:00:00Z",
        updatedAt: "2026-07-01T00:00:00Z",
      },
      {
        id: "e2",
        title: "Other",
        body: "",
        startTime: "2026-07-02T10:00:00Z",
        endTime: null,
        location: null,
        origin: "manual",
        taskId: "other",
        source: "user",
        createdAt: "2026-07-02T00:00:00Z",
        updatedAt: "2026-07-02T00:00:00Z",
      },
    ];
    expect(selectOwnedUserEvents(events, "proj-1").map((e) => e.id)).toEqual(["e1"]);
  });

  it("finds activity span for the project", () => {
    const spans: TaskActivitySpan[] = [
      {
        taskId: "proj-1",
        taskName: "Launch",
        description: null,
        analysisTimeRange: "7d",
        isActive: true,
        earliestBatchStart: "2026-07-01T00:00:00Z",
        latestBatchEnd: "2026-07-27T08:00:00Z",
        completedBatchCount: 3,
        lastAgentMessage: "ok",
        lastToolCalls: [],
        sourceKind: "task",
        worksetId: null,
      },
    ];
    expect(findActivitySpan(spans, "proj-1")?.completedBatchCount).toBe(3);
    expect(findActivitySpan(spans, "proj-1")?.lastAgentMessage).toBe("ok");
    expect(findActivitySpan(spans, "missing")).toBeNull();
  });

  it("finds workset activity spans by worksetId when taskId is null", () => {
    const spans: TaskActivitySpan[] = [
      {
        taskId: null,
        taskName: "一般",
        description: "手動或由助手建立的定時事件",
        analysisTimeRange: "all",
        isActive: false,
        earliestBatchStart: "2026-07-01T00:00:00Z",
        latestBatchEnd: "2026-07-27T08:00:00Z",
        completedBatchCount: 2,
        lastAgentMessage: null,
        lastToolCalls: [],
        sourceKind: "workset",
        worksetId: "__user__",
      },
    ];
    expect(findActivitySpan(spans, "__user__")?.sourceKind).toBe("workset");
    expect(findActivitySpan(spans, "__user__")?.worksetId).toBe("__user__");
    expect(findActivitySpan(spans, "proj-1")).toBeNull();
  });

});

import { describe, expect, it } from "vitest";

import type { UserEvent } from "../../../api/userEvents";
import { makeAnalysisTask } from "../../../test/context-mocks";
import type { TaskActivitySpan } from "../../../types/analysis";
import {
  findActivitySpan,
  isProjectTask,
  mergeChildRrules,
  selectOwnedUserEvents,
  selectProjectChildren,
  selectTopLevelTasks,
} from "./projectDetailModel";

describe("projectDetailModel", () => {
  const project = makeAnalysisTask({
    id: "proj-1",
    name: "Launch",
    analysisMode: "project",
  });
  const child = makeAnalysisTask({
    id: "child-1",
    name: "Standup",
    analysisMode: "recurring",
    parentTaskId: "proj-1",
  });
  const other = makeAnalysisTask({
    id: "event-1",
    name: "Watch",
    analysisMode: "event",
  });
  const orphanChild = makeAnalysisTask({
    id: "child-2",
    name: "Other standup",
    analysisMode: "recurring",
    parentTaskId: "proj-2",
  });

  it("detects project mode", () => {
    expect(isProjectTask(project)).toBe(true);
    expect(isProjectTask(child)).toBe(false);
    expect(isProjectTask(null)).toBe(false);
  });

  it("selects only child recurring under the project", () => {
    expect(selectProjectChildren([project, child, other, orphanChild], "proj-1")).toEqual([
      child,
    ]);
  });

  it("hides parent-linked tasks from the top-level grid", () => {
    expect(selectTopLevelTasks([project, child, other])).toEqual([project, other]);
  });

  it("keeps children in the full catalog path: dashboard top-level only, project detail still selects children", () => {
    // Shared catalog loads full GET /tasks (no top_level_only). Both filters
    // run client-side over the same list — do not server-filter the catalog.
    const catalog = [project, child, other, orphanChild];
    expect(catalog.map((task) => task.id)).toEqual([
      "proj-1",
      "child-1",
      "event-1",
      "child-2",
    ]);
    expect(selectTopLevelTasks(catalog).map((task) => task.id)).toEqual([
      "proj-1",
      "event-1",
    ]);
    expect(selectProjectChildren(catalog, "proj-1").map((task) => task.id)).toEqual([
      "child-1",
    ]);
    expect(selectProjectChildren(catalog, "proj-2").map((task) => task.id)).toEqual([
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

  it("mergeChildRrules: missing schedule stays empty without error", () => {
    const merged = mergeChildRrules(new Map(), [
      { childId: "child-1", kind: "missing" },
      { childId: "child-2", kind: "ok", rrule: "" },
    ]);
    expect(merged.rrules.size).toBe(0);
    expect(merged.error).toBeNull();
  });

  it("mergeChildRrules: failure preserves last success and surfaces error", () => {
    const prev = new Map([["child-1", "FREQ=DAILY"], ["child-2", "FREQ=WEEKLY"]]);
    const merged = mergeChildRrules(prev, [
      { childId: "child-1", kind: "error", message: "schedule upstream timeout" },
      { childId: "child-2", kind: "ok", rrule: "FREQ=MONTHLY" },
      { childId: "child-3", kind: "error", message: "second failure" },
    ]);
    expect(merged.rrules.get("child-1")).toBe("FREQ=DAILY");
    expect(merged.rrules.get("child-2")).toBe("FREQ=MONTHLY");
    expect(merged.rrules.has("child-3")).toBe(false);
    expect(merged.error).toBe("schedule upstream timeout");
  });

  it("mergeChildRrules: failure without prior value does not invent empty RRULE", () => {
    const merged = mergeChildRrules(new Map(), [
      { childId: "child-1", kind: "error", message: "boom" },
    ]);
    expect(merged.rrules.size).toBe(0);
    expect(merged.error).toBe("boom");
  });
});

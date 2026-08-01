import { describe, expect, it } from "vitest";

import type { TaskActivitySpan } from "../../types";
import { takeGanttSpans } from "./activitySpans";

function span(
  partial: Partial<TaskActivitySpan> & Pick<TaskActivitySpan, "taskName">,
): TaskActivitySpan {
  return {
    taskId: partial.taskId ?? "t",
    taskName: partial.taskName,
    analysisTimeRange: "1d",
    isActive: false,
    earliestBatchStart: "2026-01-01T00:00:00Z",
    latestBatchEnd: "2026-01-01T01:00:00Z",
    completedBatchCount: 1,
    sourceKind: "task",
    ...partial,
  };
}

describe("takeGanttSpans", () => {
  it("keeps all workset ownership rows even when over the task budget", () => {
    const rows = [
      span({ taskId: "t1", taskName: "A" }),
      span({ taskId: "t2", taskName: "B" }),
      span({ taskId: "t3", taskName: "C" }),
      span({
        taskId: "ws1",
        taskName: "Workset",
        sourceKind: "workset",
        worksetId: "ws1",
      }),
      span({
        taskId: "ws2",
        taskName: "Workset 2",
        sourceKind: "workset",
        worksetId: "ws2",
      }),
    ];
    const taken = takeGanttSpans(rows, 3);
    expect(taken.filter((r) => r.sourceKind === "workset")).toHaveLength(2);
    expect(taken.filter((r) => r.sourceKind !== "workset")).toHaveLength(1);
  });
});

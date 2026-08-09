import { describe, expect, it } from "vitest";
import {
  buildAgentTickSummaryView,
  deriveTickOutcome,
  tickOutcomeTone,
} from "./projectTickSummary";
import type { AgentTickStatus, TaskActivitySpan } from "../../../types/analysis";

describe("projectTickSummary", () => {
  it("does not invent success from empty agent fields", () => {
    expect(
      deriveTickOutcome({
        outcome: "",
        errorMessage: null,
        agentMessage: null,
      }),
    ).toBeNull();
  });

  it("prefers in-flight running over completed log", () => {
    const status: AgentTickStatus = {
      taskId: "p1",
      cursorAt: "2026-07-28T00:00:00Z",
      pendingSinceCursor: 10,
      inFlight: {
        batchId: "b-run",
        status: "processing",
        messageCount: 80,
        updatedAt: "2026-07-28T01:00:00Z",
      },
      ticks: [
        {
          batchId: "b-ok",
          status: "completed",
          outcome: "success",
          messageCount: 12,
          agentMessage: "done",
          completedAt: "2026-07-27T00:00:00Z",
        },
      ],
    };
    const view = buildAgentTickSummaryView(status, null);
    expect(view.outcome).toBe("running");
    expect(view.messageCount).toBe(80);
    expect(tickOutcomeTone("running")).toBe("info");
  });

  it("falls back to activity span when tick log is empty", () => {
    const span: TaskActivitySpan = {
      taskId: "p1",
      taskName: "P",
      analysisTimeRange: "7d",
      isActive: true,
      completedBatchCount: 1,
      lastAgentMessage: "from span",
      lastToolCalls: [],
      lastErrorMessage: null,
      lastMessageCount: 4,
    };
    const view = buildAgentTickSummaryView(
      {
        taskId: "p1",
        cursorAt: null,
        pendingSinceCursor: 0,
        ticks: [],
        inFlight: null,
      },
      span,
    );
    expect(view.outcome).toBe("success");
    expect(view.agentMessage).toBe("from span");
    expect(view.messageCount).toBe(4);
  });
});

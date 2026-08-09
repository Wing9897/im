import { describe, it, expect } from "vitest";
import { isTaskActivelyAnalyzing, mapActiveAnalysesToTasks } from "./analysisStatusModel";
import type { ActiveAnalysisState } from "../../context/appRuntimeShared";

function makeAnalysis(overrides: Partial<ActiveAnalysisState> = {}): ActiveAnalysisState {
  return {
    taskId: "task-1",
    taskName: "Task One",
    batchId: "batch-1",
    messageCount: 10,
    estimatedTokens: 1000,
    llmModel: "gpt-4",
    startedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("mapActiveAnalysesToTasks", () => {
  it("each active analysis is keyed by its taskId in the output", () => {
    const analyses = [
      makeAnalysis({ taskId: "task-a", batchId: "batch-a" }),
      makeAnalysis({ taskId: "task-b", batchId: "batch-b" }),
    ];

    const input = new Map(analyses.map((a) => [a.batchId, a]));
    const result = mapActiveAnalysesToTasks(input);

    for (const [taskId, analysis] of result.entries()) {
      expect(taskId).toBe(analysis.taskId);
    }
  });

  it("no analysis appears under a wrong taskId", () => {
    const analysis = makeAnalysis({ taskId: "task-x", batchId: "batch-x" });
    const input = new Map([[analysis.batchId, analysis]]);
    const result = mapActiveAnalysesToTasks(input);

    expect(result.get("task-x")?.taskId).toBe("task-x");
    expect(result.has("task-y")).toBe(false);
  });

  it("entries without taskId are excluded from the output", () => {
    const withTaskId = makeAnalysis({ taskId: "task-1", batchId: "batch-1" });
    const withoutTaskId = makeAnalysis({ taskId: undefined, batchId: "batch-2" });

    const input = new Map([
      [withTaskId.batchId, withTaskId],
      [withoutTaskId.batchId, withoutTaskId],
    ]);
    const result = mapActiveAnalysesToTasks(input);

    expect(result.size).toBe(1);
    for (const analysis of result.values()) {
      expect(analysis.taskId).toBeDefined();
      expect(analysis.taskId).not.toBe("");
    }
  });
});

describe("isTaskActivelyAnalyzing", () => {
  it("returns true only for task ids in the active batch set", () => {
    const input = new Map([
      ["batch-1", makeAnalysis({ taskId: "task-1", batchId: "batch-1" })],
      ["batch-2", makeAnalysis({ taskId: "task-2", batchId: "batch-2" })],
    ]);

    expect(isTaskActivelyAnalyzing(input, "task-1")).toBe(true);
    expect(isTaskActivelyAnalyzing(input, "task-2")).toBe(true);
    expect(isTaskActivelyAnalyzing(input, "task-3")).toBe(false);
  });

  it("tracks batch turnover (1,2 → 3,4)", () => {
    let active = new Map([
      ["b1", makeAnalysis({ taskId: "1", batchId: "b1" })],
      ["b2", makeAnalysis({ taskId: "2", batchId: "b2" })],
    ]);
    expect(isTaskActivelyAnalyzing(active, "1")).toBe(true);
    expect(isTaskActivelyAnalyzing(active, "3")).toBe(false);

    active = new Map([
      ["b3", makeAnalysis({ taskId: "3", batchId: "b3" })],
      ["b4", makeAnalysis({ taskId: "4", batchId: "b4" })],
    ]);
    expect(isTaskActivelyAnalyzing(active, "1")).toBe(false);
    expect(isTaskActivelyAnalyzing(active, "3")).toBe(true);
    expect(isTaskActivelyAnalyzing(active, "4")).toBe(true);
  });

  it("returns false for empty task id", () => {
    const input = new Map([["b1", makeAnalysis({ taskId: "task-1", batchId: "b1" })]]);
    expect(isTaskActivelyAnalyzing(input, "")).toBe(false);
  });
});

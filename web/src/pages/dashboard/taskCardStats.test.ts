import { describe, expect, it } from "vitest";

import { EMPTY_TASK_CARD_STATS, toTaskCardStats } from "../../domain/dashboard/taskCardStats";
import type { TaskAnalysisStats } from "../../types";

function makeStat(overrides: Partial<TaskAnalysisStats> = {}): TaskAnalysisStats {
  return {
    taskId: "t-1",
    unanalyzedCount: 3,
    queuedMessageCount: 2,
    analyzedCount: 10,
    triggerThreshold: 50,
    ...overrides,
  };
}

describe("taskCardStats", () => {
  it("maps TaskAnalysisStats to TaskCardStats", () => {
    expect(
      toTaskCardStats(makeStat(), true, {
        lastErrorMessage: "LLM timeout",
        retryCount: 2,
        analysisPaused: true,
      }),
    ).toEqual({
      unanalyzedCount: 3,
      queuedMessageCount: 2,
      analyzedCount: 10,
      triggerThreshold: 50,
      isRunning: true,
      lastErrorMessage: "LLM timeout",
      retryCount: 2,
      analysisPaused: true,
    });
  });

  it("exposes empty defaults", () => {
    expect(EMPTY_TASK_CARD_STATS).toEqual({
      unanalyzedCount: 0,
      queuedMessageCount: 0,
      analyzedCount: 0,
      triggerThreshold: 50,
      isRunning: false,
      lastErrorMessage: null,
      retryCount: 0,
      analysisPaused: false,
    });
  });
});

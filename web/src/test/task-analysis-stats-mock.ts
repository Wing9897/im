/**
 * Shared mock for useTaskAnalysisStats hook tests.
 *
 * ```ts
 * vi.mock("../../hooks/useTaskAnalysisStats", async () =>
 *   (await import("../../test/task-analysis-stats-mock")).taskAnalysisStatsModuleMock());
 * ```
 */
import { vi } from "vitest";
import type { TaskAnalysisStats } from "../types";

export const taskAnalysisStatsState = {
  taskStats: [] as TaskAnalysisStats[],
  refreshTaskStats: vi.fn(),
  notifyAnalysisEvent: vi.fn(),
};

export function makeTaskAnalysisStats(
  overrides: Partial<TaskAnalysisStats> = {},
): TaskAnalysisStats {
  return {
    taskId: "task-1",
    analyzedCount: 0,
    unanalyzedCount: 0,
    queuedMessageCount: 0,
    ...overrides,
  };
}

export function taskAnalysisStatsModuleMock() {
  return {
    useTaskAnalysisStats: () => ({
      taskStats: taskAnalysisStatsState.taskStats,
      refreshTaskStats: taskAnalysisStatsState.refreshTaskStats,
      notifyAnalysisEvent: taskAnalysisStatsState.notifyAnalysisEvent,
    }),
  };
}

export function resetTaskAnalysisStatsState(): void {
  taskAnalysisStatsState.taskStats = [];
  taskAnalysisStatsState.refreshTaskStats.mockReset();
  taskAnalysisStatsState.notifyAnalysisEvent.mockReset();
}

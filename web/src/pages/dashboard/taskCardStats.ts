import type { TaskCardStats } from "../../types/dashboard";
import type { TaskAnalysisStats } from "../../types";

export const EMPTY_TASK_CARD_STATS: TaskCardStats = {
  unanalyzedCount: 0,
  queuedMessageCount: 0,
  analyzedCount: 0,
  isRunning: false,
  lastErrorMessage: null,
  retryCount: 0,
  analysisPaused: false,
};

const statsCache = new Map<
  string,
  {
    stat: TaskAnalysisStats;
    isRunning: boolean;
    lastErrorMessage: string | null;
    retryCount: number;
    analysisPaused: boolean;
    value: TaskCardStats;
  }
>();

function statsFieldsEqual(a: TaskAnalysisStats, b: TaskAnalysisStats): boolean {
  return (
    a.unanalyzedCount === b.unanalyzedCount &&
    a.queuedMessageCount === b.queuedMessageCount &&
    a.analyzedCount === b.analyzedCount
  );
}

export function toTaskCardStats(
  stat: TaskAnalysisStats,
  isRunning: boolean,
  attention: {
    lastErrorMessage?: string | null;
    retryCount?: number;
    analysisPaused?: boolean;
  } | null = null,
): TaskCardStats {
  const lastErrorMessage = attention?.lastErrorMessage ?? null;
  const retryCount = attention?.retryCount ?? 0;
  const analysisPaused = Boolean(attention?.analysisPaused);
  const cached = statsCache.get(stat.taskId);
  if (
    cached &&
    cached.isRunning === isRunning &&
    cached.lastErrorMessage === lastErrorMessage &&
    cached.retryCount === retryCount &&
    cached.analysisPaused === analysisPaused &&
    statsFieldsEqual(cached.stat, stat)
  ) {
    return cached.value;
  }

  const value: TaskCardStats = {
    unanalyzedCount: stat.unanalyzedCount,
    queuedMessageCount: stat.queuedMessageCount,
    analyzedCount: stat.analyzedCount,
    isRunning,
    lastErrorMessage,
    retryCount,
    analysisPaused,
  };
  statsCache.set(stat.taskId, {
    stat,
    isRunning,
    lastErrorMessage,
    retryCount,
    analysisPaused,
    value,
  });
  return value;
}

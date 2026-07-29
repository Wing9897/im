/** Dashboard task card statistics (mapped from TaskAnalysisStats). */

export interface TaskCardStats {
  unanalyzedCount: number;
  queuedMessageCount: number;
  analyzedCount: number;
  isRunning: boolean;
  /** Latest batch error for this task (from queue attention / processing). */
  lastErrorMessage?: string | null;
  /** Retry count on the attention batch (QueueBoardWidget-aligned). */
  retryCount?: number;
  /** Global analysis pause — shown with attention rows (auto-pause / manual). */
  analysisPaused?: boolean;
}

import type { ProcessingBatchInfo, QueueStatus } from "../../types";

/** Per-task queue attention snapshot (no terminal `failed` batch status). */
export interface BatchAttentionInfo {
  batch: ProcessingBatchInfo;
  errorMessage: string | null;
  retryCount: number;
}

type QueueAttentionSource = Pick<
  QueueStatus,
  "attentionBatches" | "processingBatches"
> | null | undefined;

function batchTimestamp(batch: ProcessingBatchInfo): number {
  const raw = batch.updatedAt ?? batch.createdAt;
  if (!raw) return 0;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

function pickLatestForTask(
  batches: readonly ProcessingBatchInfo[],
  taskId: string,
): ProcessingBatchInfo | null {
  const matches = batches.filter((batch) => batch.taskId === taskId);
  if (matches.length === 0) return null;
  matches.sort((a, b) => {
    const aErr = a.errorMessage ? 1 : 0;
    const bErr = b.errorMessage ? 1 : 0;
    if (aErr !== bErr) return bErr - aErr;
    return batchTimestamp(b) - batchTimestamp(a);
  });
  return matches[0] ?? null;
}

/**
 * Pick the newest attention-worthy batch for a task.
 * Prefers `attentionBatches` over `processingBatches`; within a pool, prefers
 * rows with `errorMessage`, then newest `updatedAt`/`createdAt`.
 * Aligns with QueueBoardWidget: surface errorMessage + retryCount, never invent `failed`.
 */
export function pickLatestBatchAttention(
  queue: QueueAttentionSource,
  taskId: string,
): BatchAttentionInfo | null {
  if (!taskId) return null;

  const batch =
    pickLatestForTask(queue?.attentionBatches ?? [], taskId) ??
    pickLatestForTask(queue?.processingBatches ?? [], taskId);
  if (!batch) return null;

  return {
    batch,
    errorMessage: batch.errorMessage ?? null,
    retryCount: batch.retryCount ?? 0,
  };
}

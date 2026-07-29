import type { ProcessingBatchInfo } from "../../types";
import i18n from "../../i18n";

/** Badge tone for a processing / attention batch row. */
export function batchStatusTone(
  batch: ProcessingBatchInfo,
): "info" | "warning" | "danger" {
  if (batch.errorMessage) return "danger";
  if (batch.status === "pending") return "warning";
  return "info";
}

/** Short status label aligned with tasks / dashboard queue rows. */
export function batchStatusLabel(batch: ProcessingBatchInfo): string {
  if (batch.errorMessage) return String(i18n.t("board.queue.attention"));
  if (batch.status === "pending") return String(i18n.t("board.queue.retryPending"));
  return String(i18n.t("board.queue.processingBadge"));
}

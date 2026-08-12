import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "../../components/ui";
import { useAnalysisStatus } from "../../context/AnalysisStatusContext";
import {
  batchStatusLabel,
  batchStatusTone,
} from "../../domain/analysis/batchStatus";
import type { ProcessingBatchInfo } from "../../types";
import { BoardWidgetEmpty, BoardWidgetShell } from "../BoardWidgetStatus";
import type { BoardWidgetProps } from "../types";
import i18n from "../../i18n";

function BatchRow({
  batch,
}: {
  batch: ProcessingBatchInfo;
}) {
  const tokens =
    (batch.promptTokens ?? 0) > 0 || (batch.completionTokens ?? 0) > 0
      ? ` · ${batch.promptTokens ?? 0}/${batch.completionTokens ?? 0} tok`
      : "";
  return (
    <li className="board-widget-list__item">
      <div
        className="board-widget-list__row"
        data-testid={`board-queue-row-${batch.batchId}`}
      >
        <span className="board-widget-list__primary">
          {batch.taskName}
          <Badge tone={batchStatusTone(batch)} className="board-queue-batch-badge">
            {batchStatusLabel(batch)}
          </Badge>
        </span>
        <span className="board-widget-list__meta">
          {String(i18n.t("board.queue.messages", { count: batch.messageCount }))}
          {(batch.retryCount ?? 0) > 0
            ? String(i18n.t("board.queue.retry", { count: batch.retryCount }))
            : ""}
          {tokens}
        </span>
        {batch.errorMessage ? (
          <span
            className="board-widget-list__error"
            data-testid={`board-queue-error-${batch.batchId}`}
            title={batch.errorMessage}
          >
            {batch.errorMessage}
          </span>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Queue stats + batch list.
 * Shares AppRuntime `queueStatus` (global ~20s poll); only poke once when the
 * widget becomes active — do not run a second interval on top of runtime.
 */
export function QueueBoardWidget({ active = true }: BoardWidgetProps) {
  const { t } = useTranslation();
  const { queueStatus, analysisPaused, requestQueueStatusRefresh } = useAnalysisStatus();

  useEffect(() => {
    if (!active) {
      return;
    }
    requestQueueStatusRefresh();
  }, [active, requestQueueStatusRefresh]);

  const status = queueStatus;
  const attention = status?.attentionBatches ?? [];
  const processing = status?.processingBatches ?? [];
  const listed = [...processing, ...attention].slice(0, 8);
  const paused = analysisPaused || Boolean(status?.analysisPaused);

  return (
    <div className="board-widget-body" data-testid="board-queue-widget">
      <BoardWidgetShell loading={active && !status}>
        {status ? (
          <>
            <div
              className="board-queue-stats"
              data-testid="board-queue-stats"
            >
              <div className="board-queue-stat">
                <span className="board-queue-stat__label">{t("board.queue.pending")}</span>
                <span
                  className={
                    status.pendingCount > 0
                      ? "board-queue-stat__value board-queue-stat__value--warning"
                      : "board-queue-stat__value"
                  }
                >
                  {status.pendingCount}
                </span>
              </div>
              <div className="board-queue-stat">
                <span className="board-queue-stat__label">{t("board.queue.processing")}</span>
                <span
                  className={
                    processing.length > 0
                      ? "board-queue-stat__value board-queue-stat__value--info"
                      : "board-queue-stat__value"
                  }
                >
                  {processing.length}
                </span>
              </div>
              <div className="board-queue-stat">
                <span className="board-queue-stat__label">{t("board.queue.status")}</span>
                <span className="board-queue-stat__badge">
                  <Badge tone={paused ? "warning" : "success"}>
                    {paused ? t("board.queue.paused") : t("board.queue.running")}
                  </Badge>
                </span>
              </div>
            </div>
            {listed.length > 0 ? (
              <ul className="board-widget-list">
                {listed.map((batch) => (
                  <BatchRow
                    key={batch.batchId}
                    batch={batch}
                  />
                ))}
              </ul>
            ) : (
              <BoardWidgetEmpty>{t("board.queue.noBatches")}</BoardWidgetEmpty>
            )}
          </>
        ) : null}
      </BoardWidgetShell>
    </div>
  );
}

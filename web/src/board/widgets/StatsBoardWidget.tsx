import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { fetchTaskAnalysisStats } from "../../api/results";
import type { TaskAnalysisStats } from "../../types";
import { BoardWidgetShell } from "../BoardWidgetStatus";
import { BOARD_POLL_MS, useBoardWidgetPoll } from "../useBoardWidgetPoll";
import type { BoardWidgetProps } from "../types";

/** Compact per-task analysis stats (7d) for the ops board. */
export function StatsBoardWidget({ active = true }: BoardWidgetProps) {
  const { t } = useTranslation();
  const fetcher = useCallback(() => fetchTaskAnalysisStats("7d"), []);
  const { data: rows, error, loading, refresh } = useBoardWidgetPoll<TaskAnalysisStats[]>(
    fetcher,
    BOARD_POLL_MS.standard,
    { active },
  );

  const totals = (rows ?? []).reduce(
    (acc, row) => {
      acc.analyzed += row.analyzedCount;
      acc.unanalyzed += row.unanalyzedCount;
      acc.queued += row.queuedMessageCount;
      return acc;
    },
    { analyzed: 0, unanalyzed: 0, queued: 0 },
  );

  return (
    <div className="board-widget-body board-widget-stats" data-testid="board-stats-widget">
      <BoardWidgetShell
        loading={loading && !rows}
        error={!rows ? error : null}
        onRetry={refresh}
        empty={Array.isArray(rows) && rows.length === 0}
        emptyLabel={t("board.stats.empty")}
      >
        {rows ? (
          <>
            <div
              className="board-queue-stats"
              data-testid="board-stats-totals"
            >
              <div className="board-queue-stat">
                <span className="board-queue-stat__label">{t("board.stats.analyzed")}</span>
                <span className="board-queue-stat__value">{totals.analyzed}</span>
              </div>
              <div className="board-queue-stat">
                <span className="board-queue-stat__label">{t("board.stats.unanalyzed")}</span>
                <span
                  className={
                    totals.unanalyzed > 0
                      ? "board-queue-stat__value board-queue-stat__value--warning"
                      : "board-queue-stat__value"
                  }
                >
                  {totals.unanalyzed}
                </span>
              </div>
              <div className="board-queue-stat">
                <span className="board-queue-stat__label">{t("board.stats.queued")}</span>
                <span
                  className={
                    totals.queued > 0
                      ? "board-queue-stat__value board-queue-stat__value--info"
                      : "board-queue-stat__value"
                  }
                >
                  {totals.queued}
                </span>
              </div>
            </div>
            <ul className="board-widget-list">
              {rows.slice(0, 8).map((row) => (
                <li key={row.taskId} className="board-widget-list__item">
                  <div
                    className="board-widget-list__row"
                    data-testid={`board-stats-row-${row.taskId}`}
                  >
                    <span className="board-widget-list__primary">{row.taskId}</span>
                    <span className="board-widget-list__meta">
                      {t("board.stats.rowMeta", {
                        analyzed: row.analyzedCount,
                        unanalyzed: row.unanalyzedCount,
                      })}
                      {row.queuedMessageCount > 0
                        ? t("board.stats.rowQueued", { count: row.queuedMessageCount })
                        : ""}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </BoardWidgetShell>
    </div>
  );
}

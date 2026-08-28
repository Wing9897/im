import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { fetchTaskAnalysisStats } from "../../api/results";
import { Badge } from "../../components/ui";
import { useAnalysisStatus } from "../../context/AnalysisStatusContext";
import { useTaskCatalog, useTaskNameById } from "../../context/TaskCatalogContext";
import { mapActiveAnalysesToTasks } from "../../domain/analysis/analysisStatusModel";
import { pickLatestBatchAttention } from "../../domain/analysis/batchAttention";
import { formatAnalysisErrorMessage } from "../../domain/analysis/formatAnalysisError";
import {
  EMPTY_TASK_CARD_STATS,
  toTaskCardStats,
} from "../../domain/dashboard/taskCardStats";
import { buildBoardWorksetGroups } from "../../domain/dashboard/worksetTaskGroups";
import { truncateDisplayText } from "../../domain/text/truncateDisplayText";
import type { TaskAnalysisStats } from "../../types";
import type { AnalysisTask } from "../../types/tasks";
import { BoardWorksetGroupHeader } from "../components/BoardWorksetGroupHeader";
import { BoardWidgetShell } from "../BoardWidgetStatus";
import { BOARD_POLL_MS, useBoardWidgetPoll } from "../useBoardWidgetPoll";
import type { BoardWidgetProps } from "../types";

const MAX_STAT_ROWS = 8;
const ERROR_PREVIEW_MAX = 96;

function BoardStatsRow({
  row,
  taskName,
  cardStats,
}: {
  row: TaskAnalysisStats;
  taskName: string;
  cardStats: ReturnType<typeof toTaskCardStats>;
}) {
  const { t } = useTranslation(["board", "common"]);
  const attentionErrorText = formatAnalysisErrorMessage(cardStats.lastErrorMessage, t);
  const queued = cardStats.queuedMessageCount;
  const unanalyzed = cardStats.unanalyzedCount;

  return (
    <li className="board-widget-list__item">
      <div
        className="board-widget-list__row"
        data-testid={`board-stats-row-${row.taskId}`}
      >
        <span className="board-widget-list__primary">{taskName}</span>
        <span className="board-widget-list__meta board-stats-row__meta">
          <span>{t("board:stats.analyzed")}</span>
          <span className="board-stats-row__value">{cardStats.analyzedCount}</span>
          <span>·</span>
          <span>{t("board:stats.unanalyzed")}</span>
          <span
            className={
              unanalyzed > 0
                ? "board-stats-row__value board-stats-row__value--warning"
                : "board-stats-row__value"
            }
          >
            {unanalyzed}
          </span>
          <span>·</span>
          <span>{t("board:stats.queued")}</span>
          <span
            className={
              queued > 0
                ? "board-stats-row__value board-stats-row__value--info"
                : "board-stats-row__value"
            }
          >
            {queued}
          </span>
        </span>
        {attentionErrorText ? (
          <span
            className="board-widget-list__error"
            data-testid={`board-stats-error-${row.taskId}`}
            title={attentionErrorText}
          >
            <Badge tone="danger" className="board-queue-batch-badge">
              {t("board:queue.attention")}
            </Badge>
            {truncateDisplayText(attentionErrorText, ERROR_PREVIEW_MAX)}
          </span>
        ) : null}
      </div>
    </li>
  );
}

/** Compact per-task analysis stats (7d) grouped by workset for the ops board. */
export function StatsBoardWidget({ active = true }: BoardWidgetProps) {
  const { t } = useTranslation();
  const taskNameById = useTaskNameById();
  const { tasks, worksets } = useTaskCatalog();
  const { activeAnalyses, queueStatus, analysisPaused } = useAnalysisStatus();
  const fetcher = useCallback(() => fetchTaskAnalysisStats("7d"), []);
  const { data: rows, error, loading, refresh } = useBoardWidgetPoll<TaskAnalysisStats[]>(
    fetcher,
    BOARD_POLL_MS.standard,
    { active },
  );

  const activeAnalysesByTaskId = useMemo(
    () => mapActiveAnalysesToTasks(activeAnalyses),
    [activeAnalyses],
  );
  const paused = analysisPaused || Boolean(queueStatus?.analysisPaused);

  const statsByTaskId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof toTaskCardStats>>();
    for (const row of rows ?? []) {
      const attention = pickLatestBatchAttention(queueStatus, row.taskId);
      map.set(
        row.taskId,
        toTaskCardStats(row, activeAnalysesByTaskId.has(row.taskId), {
          lastErrorMessage: attention?.errorMessage ?? null,
          retryCount: attention?.retryCount ?? 0,
          analysisPaused: paused && Boolean(attention),
        }),
      );
    }
    return map;
  }, [rows, activeAnalysesByTaskId, queueStatus, paused]);

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);

  const statsTasks = useMemo(() => {
    const seen = new Set<string>();
    const ordered: AnalysisTask[] = [];
    for (const row of rows ?? []) {
      if (seen.has(row.taskId)) continue;
      seen.add(row.taskId);
      const task = taskById.get(row.taskId);
      if (task) ordered.push(task);
    }
    return ordered;
  }, [rows, taskById]);

  const worksetCoverById = useMemo(
    () => new Map(worksets.map((ws) => [ws.id, ws.cover ?? ""] as const)),
    [worksets],
  );

  const groups = useMemo(
    () =>
      buildBoardWorksetGroups({
        visibleTasks: statsTasks,
        worksets,
        t,
      }),
    [statsTasks, worksets, t],
  );

  const groupedRows = useMemo(() => {
    const rowByTaskId = new Map((rows ?? []).map((row) => [row.taskId, row]));
    let remaining = MAX_STAT_ROWS;
    const next: Array<{
      group: (typeof groups)[number];
      rows: TaskAnalysisStats[];
    }> = [];
    for (const group of groups) {
      if (remaining <= 0) break;
      const groupRows: TaskAnalysisStats[] = [];
      for (const task of group.tasks) {
        const row = rowByTaskId.get(task.id);
        if (!row) continue;
        groupRows.push(row);
        remaining -= 1;
        if (remaining <= 0) break;
      }
      if (groupRows.length > 0) {
        next.push({ group, rows: groupRows });
      }
    }
    return next;
  }, [groups, rows]);

  const orphanRows = useMemo(() => {
    const groupedIds = new Set(groupedRows.flatMap((entry) => entry.rows.map((row) => row.taskId)));
    return (rows ?? [])
      .filter((row) => !groupedIds.has(row.taskId))
      .slice(0, Math.max(0, MAX_STAT_ROWS - groupedRows.reduce((n, g) => n + g.rows.length, 0)));
  }, [groupedRows, rows]);

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
        emptyLabel={t("board:stats.empty")}
      >
        {rows ? (
          <>
            <div className="board-queue-stats" data-testid="board-stats-totals">
              <div className="board-queue-stat">
                <span className="board-queue-stat__label">{t("board:stats.analyzed")}</span>
                <span className="board-queue-stat__value">{totals.analyzed}</span>
              </div>
              <div className="board-queue-stat">
                <span className="board-queue-stat__label">{t("board:stats.unanalyzed")}</span>
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
                <span className="board-queue-stat__label">{t("board:stats.queued")}</span>
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
            {groupedRows.length > 0 || orphanRows.length > 0 ? (
              <div className="board-widget-workset-groups">
                {groupedRows.map(({ group, rows: groupRows }) => (
                  <section
                    key={group.key}
                    className="board-widget-workset-group"
                    data-testid={`board-stats-group-${group.key}`}
                  >
                    <BoardWorksetGroupHeader
                      worksetId={group.key}
                      title={group.title}
                      cover={worksetCoverById.get(group.key)}
                    />
                    <ul className="board-widget-list">
                      {groupRows.map((row) => (
                        <BoardStatsRow
                          key={row.taskId}
                          row={row}
                          taskName={
                            taskNameById.get(row.taskId) ??
                            row.taskId
                          }
                          cardStats={statsByTaskId.get(row.taskId) ?? EMPTY_TASK_CARD_STATS}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
                {orphanRows.length > 0 ? (
                  <ul className="board-widget-list">
                    {orphanRows.map((row) => (
                      <BoardStatsRow
                        key={row.taskId}
                        row={row}
                        taskName={taskNameById.get(row.taskId) ?? row.taskId}
                        cardStats={statsByTaskId.get(row.taskId) ?? EMPTY_TASK_CARD_STATS}
                      />
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </BoardWidgetShell>
    </div>
  );
}

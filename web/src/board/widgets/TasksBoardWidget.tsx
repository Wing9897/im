import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "../../components/ui";
import { useTaskCatalog } from "../../context/TaskCatalogContext";
import { buildBoardWorksetGroups } from "../../domain/dashboard/worksetTaskGroups";
import { selectTopLevelTasks } from "../../domain/tasks/agentTaskSelectors";
import { formatAnalysisMode } from "../../utils/analysis";
import { BoardWorksetGroupHeader } from "../components/BoardWorksetGroupHeader";
import { BoardWidgetShell } from "../BoardWidgetStatus";
import type { BoardWidgetProps } from "../types";

const MAX_TASK_ROWS = 14;

/** Compact analysis-task list grouped by workset for the ops board. */
export function TasksBoardWidget({ active = true }: BoardWidgetProps) {
  const { t } = useTranslation();
  const { tasks, worksets, tasksLoading, taskLoadError, refreshTasks } = useTaskCatalog();

  const worksetCoverById = useMemo(
    () => new Map(worksets.map((ws) => [ws.id, ws.cover ?? ""] as const)),
    [worksets],
  );

  const groups = useMemo(
    () =>
      buildBoardWorksetGroups({
        visibleTasks: selectTopLevelTasks(tasks),
        worksets,
        t,
      }),
    [tasks, worksets, t],
  );

  const visibleGroups = useMemo(() => {
    let remaining = MAX_TASK_ROWS;
    const next: Array<(typeof groups)[number] & { tasks: typeof tasks }> = [];
    for (const group of groups) {
      if (remaining <= 0) break;
      const slice = group.tasks.slice(0, remaining);
      if (slice.length === 0) continue;
      remaining -= slice.length;
      next.push({ ...group, tasks: slice });
    }
    return next;
  }, [groups]);

  const hasTasks = groups.some((group) => group.tasks.length > 0);

  return (
    <div className="board-widget-body" data-testid="board-tasks-widget">
      <BoardWidgetShell
        loading={active && tasksLoading && tasks.length === 0}
        error={tasks.length === 0 ? taskLoadError : null}
        onRetry={() => {
          void refreshTasks();
        }}
        empty={!tasksLoading && !hasTasks}
        emptyLabel={t("board:tasks.empty")}
      >
        {visibleGroups.length > 0 ? (
          <div className="board-widget-workset-groups">
            {visibleGroups.map((group) => (
              <section
                key={group.key}
                className="board-widget-workset-group"
                data-testid={`board-tasks-group-${group.key}`}
              >
                <BoardWorksetGroupHeader
                  worksetId={group.key}
                  title={group.title}
                  cover={worksetCoverById.get(group.key)}
                />
                <ul className="board-widget-list">
                  {group.tasks.map((task) => {
                    const channelCount = (task.channelIds ?? []).length;
                    return (
                      <li key={task.id} className="board-widget-list__item">
                        <div
                          className="board-widget-list__row"
                          data-testid={`board-tasks-row-${task.id}`}
                        >
                          <span className="board-widget-list__primary">
                            {task.name || t("board:common.unnamed")}
                            <Badge tone={task.isActive ? "success" : "neutral"}>
                              {task.isActive
                                ? t("board:common.enabled")
                                : t("board:common.disabled")}
                            </Badge>
                          </span>
                          <span className="board-widget-list__meta">
                            {formatAnalysisMode(task.analysisMode)}
                            {channelCount > 0
                              ? ` · ${t("board:common.channelCount", { count: channelCount })}`
                              : ""}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        ) : null}
      </BoardWidgetShell>
    </div>
  );
}

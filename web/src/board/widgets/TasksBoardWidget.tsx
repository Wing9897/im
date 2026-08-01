import { useTranslation } from "react-i18next";
import { useTaskCatalog } from "../../context/TaskCatalogContext";
import { Badge } from "../../components/ui";
import { BoardWidgetShell } from "../BoardWidgetStatus";
import type { BoardWidgetProps } from "../types";

/** Compact analysis-task list for the ops board (shared TaskCatalog — no extra poll). */
export function TasksBoardWidget({ active = true }: BoardWidgetProps) {
  const { t } = useTranslation();
  const { tasks, tasksLoading, taskLoadError, refreshTasks } = useTaskCatalog();

  const items = tasks.slice(0, 14);

  return (
    <div className="board-widget-body" data-testid="board-tasks-widget">
      <BoardWidgetShell
        loading={active && tasksLoading && tasks.length === 0}
        error={tasks.length === 0 ? taskLoadError : null}
        onRetry={() => {
          void refreshTasks();
        }}
        empty={!tasksLoading && tasks.length === 0}
        emptyLabel={t("board.tasks.empty")}
      >
        {items.length > 0 ? (
          <ul className="board-widget-list">
            {items.map((task) => (
              <li key={task.id} className="board-widget-list__item">
                <button
                  type="button"
                  className="board-widget-list__row"
                  data-testid={`board-tasks-row-${task.id}`}
                >
                  <span className="board-widget-list__primary">
                    {task.name || t("board.common.unnamed")}
                    <Badge tone={task.isActive ? "success" : "neutral"}>
                      {task.isActive ? t("board.common.enabled") : t("board.common.disabled")}
                    </Badge>
                  </span>
                  <span className="board-widget-list__meta">
                    {task.analysisMode}
                    {task.channelIds.length > 0
                      ? ` · ${t("board.common.channelCount", { count: task.channelIds.length })}`
                      : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </BoardWidgetShell>
    </div>
  );
}

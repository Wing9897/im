import { lazy, Suspense, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { fetchTaskActivitySpans } from "../../api/tasks";
import { USER_EVENTS_FILTER_ID } from "../../domain/timeline/userEvents";
import { useTaskCatalog } from "../../context/TaskCatalogContext";
import type { TaskActivitySpan } from "../../types";
import { TaskFilterControl } from "../../components/TaskFilterControl";
import { withUserEventsFilterOption } from "../../domain/timeline/taskFilterOptions";
import { useUserEventsFilterLabel } from "../../domain/timeline/useUserEventsFilterLabel";
import { useBoardWidgetHeaderActions } from "../BoardWidgetFrame";
import { BoardWidgetShell } from "../BoardWidgetStatus";
import { useBoardTaskFilter } from "../useBoardTaskFilter";
import { BOARD_POLL_MS, useBoardWidgetPoll } from "../useBoardWidgetPoll";
import type { BoardWidgetProps } from "../types";
import { useBoardGanttViewMode } from "../useBoardGanttViewMode";
import { GanttViewModeControls } from "./GanttViewModeControls";
import { unnamedTaskLabel } from "../boardLabels";

const LazyGanttBoardEmbed = lazy(() =>
  import("../embeds/GanttBoardEmbed").then((m) => ({ default: m.GanttBoardEmbed })),
);

const GANTT_EMBED_LIMIT = 40;

/**
 * Cap task rows but always keep the API's virtual「用戶或助手」span
 * (`taskId === __user__`) so the checklist filter is not empty.
 */
function takeGanttSpans(rows: TaskActivitySpan[]): TaskActivitySpan[] {
  const userSpan = rows.find((row) => row.taskId === USER_EVENTS_FILTER_ID);
  const taskRows = rows.filter((row) => row.taskId !== USER_EVENTS_FILTER_ID);
  const capped = taskRows.slice(0, userSpan ? GANTT_EMBED_LIMIT - 1 : GANTT_EMBED_LIMIT);
  return userSpan ? [...capped, userSpan] : capped;
}

/** Compact lazy gantt (activity spans by task); mounts only while `active`. */
export function GanttBoardWidget({ active = true, widgetId }: BoardWidgetProps) {
  const { t } = useTranslation();
  const { viewMode, setViewMode } = useBoardGanttViewMode(widgetId);
  const { selectedTaskIds, setSelectedTaskIds, filterByTaskId } = useBoardTaskFilter(widgetId);
  const ariaPrefix = t("board.ganttWidget.byTaskAria");

  // Backend `/activity-spans` already appends a virtual __user__ row when user_events exist.
  const spansFetcher = useCallback(
    () => fetchTaskActivitySpans().then(takeGanttSpans),
    [],
  );

  const { data: spans, error, loading, refresh } = useBoardWidgetPoll<TaskActivitySpan[]>(
    spansFetcher,
    BOARD_POLL_MS.standard,
    { active },
  );
  const { tasks } = useTaskCatalog();
  const userEventsLabel = useUserEventsFilterLabel();

  const filterOptions = useMemo(() => {
    if (tasks.length > 0) {
      return withUserEventsFilterOption(
        tasks.map((task) => ({ id: task.id, name: task.name.trim() || unnamedTaskLabel() })),
        userEventsLabel,
      );
    }
    const spanOptions = (spans ?? []).map((s) => ({
      id: s.taskId,
      name:
        s.taskId === USER_EVENTS_FILTER_ID
          ? userEventsLabel
          : s.taskName.trim() || unnamedTaskLabel(),
    }));
    return withUserEventsFilterOption(spanOptions, userEventsLabel);
  }, [tasks, spans, userEventsLabel]);

  const filteredSpans = useMemo(
    () => filterByTaskId(spans ?? []),
    [spans, filterByTaskId],
  );

  const headerActions = useMemo(
    () => (
      <>
        <TaskFilterControl
          tasks={filterOptions}
          selectedTaskIds={selectedTaskIds}
          onChange={setSelectedTaskIds}
          ariaLabelPrefix={ariaPrefix}
        />
        <GanttViewModeControls
          viewMode={viewMode}
          onChange={setViewMode}
          ariaLabelPrefix={ariaPrefix}
          testIdPrefix="board-gantt"
        />
      </>
    ),
    [ariaPrefix, filterOptions, selectedTaskIds, setSelectedTaskIds, setViewMode, viewMode],
  );
  useBoardWidgetHeaderActions(headerActions);

  return (
    <div className="board-widget-body board-widget-gantt" data-testid="board-gantt-widget">
      <BoardWidgetShell
        active={active}
        pausedLabel={t("board.common.paused", { name: t("board.ganttWidget.pausedName") })}
        pausedTestId="board-gantt-paused"
        loading={loading && !spans}
        error={!spans ? error : null}
        onRetry={refresh}
      >
        <Suspense fallback={<p className="board-widget-muted">{t("board.common.loadingGantt")}</p>}>
          <LazyGanttBoardEmbed
            spans={filteredSpans}
            viewMode={viewMode}
            labelHeader={t("board.ganttWidget.labelTask")}
            emptyLabel={t("board.gantt.defaultEmptyLabel")}
          />
        </Suspense>
      </BoardWidgetShell>
    </div>
  );
}

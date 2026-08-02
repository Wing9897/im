import { lazy, Suspense, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useTaskCatalog } from "../../context/TaskCatalogContext";
import type { TaskActivitySpan } from "../../types";
import { isWorksetActivitySpan } from "../../types/analysis";
import { SourceFilterDialog } from "../../components/SourceFilterDialog";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import {
  GANTT_EMBED_SPAN_LIMIT,
  loadGanttActivitySpans,
} from "../../domain/gantt/activitySpans";
import { useGeneralWorksetLabel } from "../../domain/timeline/useGeneralWorksetLabel";
import { useBoardWidgetHeaderActions } from "../BoardWidgetFrame";
import { BoardWidgetShell } from "../BoardWidgetStatus";
import {
  boardSourceFilterExpandTasks,
  boardSourceFilterWorksets,
} from "../boardSourceFilterOptions";
import { resolveSpanWorksetId, useBoardSourceFilter } from "../useBoardSourceFilter";
import { BOARD_POLL_MS, useBoardWidgetPoll } from "../useBoardWidgetPoll";
import type { BoardWidgetProps } from "../types";
import { useRefreshOnAnalysisEvent } from "../../hooks/useRefreshOnAnalysisEvent";
import { useBoardGanttViewMode } from "../useBoardGanttViewMode";
import { GanttViewModeControls } from "./GanttViewModeControls";
import { unnamedTaskLabel } from "../boardLabels";

const LazyGanttBoardEmbed = lazy(() =>
  import("../embeds/GanttBoardEmbed").then((m) => ({ default: m.GanttBoardEmbed })),
);

/** Compact lazy gantt (activity spans by task); mounts only while `active`. */
export function GanttBoardWidget({ active = true, widgetId }: BoardWidgetProps) {
  const { t } = useTranslation();
  const { viewMode, setViewMode } = useBoardGanttViewMode(widgetId);
  const { selection, setSelection, filterBySource } = useBoardSourceFilter(widgetId);
  const ariaPrefix = t("board.ganttWidget.byTaskAria");

  // Backend `/activity-spans` emits one ownership row per workset with user_events.
  const spansFetcher = useCallback(
    () => loadGanttActivitySpans({ limit: GANTT_EMBED_SPAN_LIMIT }),
    [],
  );

  const { data: spans, error, loading, refresh } = useBoardWidgetPoll<TaskActivitySpan[]>(
    spansFetcher,
    BOARD_POLL_MS.standard,
    { active },
  );
  useRefreshOnAnalysisEvent(refresh);
  const { tasks, worksets } = useTaskCatalog();
  const userEventsLabel = useGeneralWorksetLabel();

  // Builtin workset covers「一般」— do not inject a fake __user__ task row.
  const filterOptions = useMemo(() => {
    if (tasks.length > 0) {
      return tasks.map((task) => ({
        id: task.id,
        name: task.name.trim() || unnamedTaskLabel(),
      }));
    }
    return (spans ?? [])
      .filter((s) => !isWorksetActivitySpan(s) && s.taskId)
      .map((s) => ({
        id: s.taskId as string,
        name: s.taskName.trim() || unnamedTaskLabel(),
      }));
  }, [tasks, spans]);

  const filteredSpans = useMemo(
    () => filterBySource(spans ?? []),
    [spans, filterBySource],
  );

  const labeledSpans = useMemo(() => {
    const nameByWorkset = new Map(
      worksets.map((ws) => [
        ws.id,
        ws.id === SYSTEM_WORKSET_ID ? userEventsLabel : ws.name,
      ]),
    );
    return filteredSpans.map((span) => {
      if (!isWorksetActivitySpan(span)) return span;
      const worksetId = resolveSpanWorksetId(span);
      const fromCatalog = worksetId ? nameByWorkset.get(worksetId) : undefined;
      const label =
        worksetId === SYSTEM_WORKSET_ID
          ? userEventsLabel
          : fromCatalog || span.taskName.trim() || worksetId || span.taskId || "";
      return span.taskName === label ? span : { ...span, taskName: label };
    });
  }, [filteredSpans, worksets, userEventsLabel]);

  const headerActions = useMemo(
    () => (
      <>
        <SourceFilterDialog
          tasks={filterOptions}
          worksets={boardSourceFilterWorksets(worksets, userEventsLabel)}
          expandTasks={boardSourceFilterExpandTasks(tasks)}
          selection={selection}
          onChange={setSelection}
          ariaLabelPrefix={ariaPrefix}
          variant="board"
        />
        <GanttViewModeControls
          viewMode={viewMode}
          onChange={setViewMode}
          ariaLabelPrefix={ariaPrefix}
          testIdPrefix="board-gantt"
        />
      </>
    ),
    [ariaPrefix, filterOptions, selection, setSelection, setViewMode, tasks, userEventsLabel, viewMode, worksets],
  );
  useBoardWidgetHeaderActions(headerActions);

  const showWorksetLegend = labeledSpans.some((span) => isWorksetActivitySpan(span));

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
        {showWorksetLegend ? (
          <p className="board-widget-muted" data-testid="board-gantt-workset-legend">
            {t("board.ganttWidget.worksetSpanLegend")}
          </p>
        ) : null}
        <Suspense fallback={<p className="board-widget-muted">{t("board.common.loadingGantt")}</p>}>
          <LazyGanttBoardEmbed
            spans={labeledSpans}
            viewMode={viewMode}
            labelHeader={t("board.ganttWidget.labelTask")}
            emptyLabel={t("board.gantt.defaultEmptyLabel")}
          />
        </Suspense>
      </BoardWidgetShell>
    </div>
  );
}

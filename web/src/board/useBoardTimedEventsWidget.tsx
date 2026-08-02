/**
 * Shared poll + resolve + source-filter header wiring for timed-event Board widgets.
 * Does not cover activity-span Gantt (ownership dual-track).
 */

import { useEffect, useMemo, type ReactNode } from "react";
import { SourceFilterDialog } from "../components/SourceFilterDialog";
import { catalogOrEventSourceOptions } from "../domain/timeline/sourceFilterOptions";
import { withResolvedUserEventTaskNames } from "../domain/timeline/timedEventMerge";
import { subscribeResourceModified } from "../domain/sse/resourceModified";
import { useGeneralWorksetLabel } from "../domain/timeline/useGeneralWorksetLabel";
import {
  useTaskCatalog,
  useTaskNameById,
  useWorksetNameById,
} from "../context/TaskCatalogContext";
import type { AnalysisEvent } from "../types";
import { useBoardWidgetHeaderActions } from "./BoardWidgetFrame";
import {
  boardSourceFilterExpandTasks,
  boardSourceFilterWorksets,
} from "./boardSourceFilterOptions";
import { useBoardSourceFilter } from "./useBoardSourceFilter";
import { useBoardWidgetPoll } from "./useBoardWidgetPoll";

export function useBoardTimedEventsWidget(options: {
  widgetId: string;
  active: boolean;
  fetcher: () => Promise<AnalysisEvent[]>;
  pollMs: number;
  ariaLabelPrefix: string;
  /** Extra header controls after the source filter (e.g. gantt view mode). */
  headerExtra?: ReactNode;
}) {
  const { widgetId, active, fetcher, pollMs, ariaLabelPrefix, headerExtra } = options;
  const { selection, setSelection, filterBySource } = useBoardSourceFilter(widgetId);
  const { data: fetchedEvents, error, loading, refresh } = useBoardWidgetPoll<AnalysisEvent[]>(
    fetcher,
    pollMs,
    { active },
  );
  const { tasks, worksets } = useTaskCatalog();
  const taskNameById = useTaskNameById();
  const worksetNameById = useWorksetNameById();
  const generalWorksetLabel = useGeneralWorksetLabel();

  useEffect(
    () =>
      subscribeResourceModified((detail) => {
        if (
          detail.resourceType === "task" ||
          detail.resourceType === "user_event" ||
          detail.resourceType === "item" ||
          detail.resourceType === "item_category"
        ) {
          void refresh();
        }
      }),
    [refresh],
  );

  const events = useMemo(
    () =>
      fetchedEvents
        ? withResolvedUserEventTaskNames(
            fetchedEvents,
            taskNameById,
            generalWorksetLabel,
            worksetNameById,
          )
        : null,
    [fetchedEvents, taskNameById, generalWorksetLabel, worksetNameById],
  );

  const filterOptions = useMemo(
    () => catalogOrEventSourceOptions(tasks, events),
    [tasks, events],
  );

  const filteredEvents = useMemo(
    () => filterBySource(events ?? []),
    [events, filterBySource],
  );

  const headerActions = useMemo(
    () => (
      <>
        <SourceFilterDialog
          tasks={filterOptions}
          worksets={boardSourceFilterWorksets(worksets, generalWorksetLabel)}
          expandTasks={boardSourceFilterExpandTasks(tasks)}
          selection={selection}
          onChange={setSelection}
          ariaLabelPrefix={ariaLabelPrefix}
          variant="board"
        />
        {headerExtra}
      </>
    ),
    [
      ariaLabelPrefix,
      filterOptions,
      generalWorksetLabel,
      headerExtra,
      selection,
      setSelection,
      tasks,
      worksets,
    ],
  );
  useBoardWidgetHeaderActions(headerActions);

  return {
    selection,
    events,
    filteredEvents,
    loading,
    error,
    refresh,
  };
}

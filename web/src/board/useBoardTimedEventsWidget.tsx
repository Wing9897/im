/**
 * Shared poll + resolve + source-filter header wiring for timed-event Board widgets.
 * Does not cover activity-span Gantt (ownership dual-track).
 */

import { useEffect, useMemo, type ReactNode } from "react";
import { SourceFilterDialog } from "../components/SourceFilterDialog";
import { catalogOrEventSourceOptions } from "../domain/timeline/sourceFilterOptions";
import { withResolvedUserEventTaskNames } from "../domain/timeline/timedEventMerge";
import { subscribeResourceModified } from "../domain/sse/resourceModified";
import { shouldTimelineRefreshForResource } from "../domain/timeline/timelineCalendarRefresh";
import { useGeneralWorksetLabel } from "../domain/timeline/useGeneralWorksetLabel";
import {
  useTaskCatalog,
  useTaskNameById,
  useWorksetNameById,
} from "../context/TaskCatalogContext";
import { ANALYSIS_EVENTS_MODES } from "../domain/tasks/analysisModeCapabilities";
import { useRefreshOnAnalysisEvent } from "../hooks/useRefreshOnAnalysisEvent";
import type { AnalysisEvent } from "../types";
import { useBoardWidgetHeaderActions } from "./BoardWidgetFrame";
import {
  boardSourceFilterExpandTasks,
  boardSourceFilterWorksets,
} from "./boardSourceFilterOptions";
import { useBoardSourceFilter } from "./useBoardSourceFilter";
import { useBoardWidgetPoll } from "./useBoardWidgetPoll";
import {
  pruneSubscribedCalendarSelection,
  resolveSubscribeAvailability,
} from "../domain/calendarShare/subscribedCalendars";
import {
  subscribeFilterCalendarsFromCatalog,
  useCalendarShareCatalog,
} from "../domain/calendarShare/useCalendarShareCatalog";
import { usePersistedSubscribeFilter } from "../domain/calendarShare/usePersistedSubscribeFilter";

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
  const catalog = useCalendarShareCatalog();
  const subscribeCalendars = useMemo(
    () => subscribeFilterCalendarsFromCatalog(catalog.items),
    [catalog.items],
  );
  const subscribeCatalogKeys = useMemo(
    () => subscribeCalendars.map((row) => row.key),
    [subscribeCalendars],
  );
  const [selectedSubscribeKeys, setSelectedSubscribeKeys] = usePersistedSubscribeFilter();
  const subscribeAvailability = resolveSubscribeAvailability({
    connected: Boolean(catalog.session),
    catalogUnreachable: catalog.unreachable,
    eventsError: catalog.error,
  });

  useEffect(() => {
    setSelectedSubscribeKeys((prev) => pruneSubscribedCalendarSelection(prev, subscribeCatalogKeys));
  }, [subscribeCatalogKeys, setSelectedSubscribeKeys]);

  useEffect(
    () =>
      subscribeResourceModified((detail) => {
        if (shouldTimelineRefreshForResource(detail.resourceType)) {
          void refresh();
        }
      }),
    [refresh],
  );

  // Poll alone can lag ~45s after intel_event / agent analysis; pages refresh on SSE.
  useRefreshOnAnalysisEvent(refresh, { analysisMode: ANALYSIS_EVENTS_MODES });

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
          subscribeCalendars={subscribeCalendars}
          selectedSubscribeKeys={selectedSubscribeKeys}
          onChangeSubscribeKeys={setSelectedSubscribeKeys}
          subscribeAvailability={subscribeAvailability}
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
      subscribeAvailability,
      subscribeCalendars,
      selectedSubscribeKeys,
      setSelectedSubscribeKeys,
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

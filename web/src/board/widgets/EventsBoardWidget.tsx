import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { fetchEvents } from "../../api/results";
import { listUserEvents } from "../../api/userEvents";
import { Badge } from "../../components/ui";
import { useTaskCatalog, useTaskNameById, useWorksetNameById } from "../../context/TaskCatalogContext";
import { formatIntelligenceEventTime } from "../../domain/intelligence/intelligenceSourceMeta";
import { useGeneralWorksetLabel } from "../../domain/timeline/useGeneralWorksetLabel";
import type { AnalysisEvent } from "../../types";
import { getEventTimestamp, isMappableCoordinate } from "../../domain/intelligence/mapFilters";
import { SourceFilterDialog } from "../../components/SourceFilterDialog";
import { catalogOrEventSourceOptions } from "../../domain/timeline/sourceFilterOptions";
import {
  userEventToBoardEvent,
  withResolvedUserEventTaskNames,
} from "../../domain/timeline/timedEventMerge";
import { useBoardWidgetHeaderActions } from "../BoardWidgetFrame";
import { BoardWidgetShell } from "../BoardWidgetStatus";
import { useBoardSourceFilter } from "../useBoardSourceFilter";
import { BOARD_POLL_MS, useBoardWidgetPoll } from "../useBoardWidgetPoll";
import {
  focusBoardEvent,
  getBoardFocusTarget,
  subscribeBoardFocus,
} from "../boardFocusStore";
import type { BoardWidgetProps } from "../types";
import { untitledLabel } from "../boardLabels";
import { SYSTEM_WORKSET_ID } from "../../types/worksets";
import { isEmptySourceFilter } from "../../domain/tasks/sourceFilterSelection";

const EVENTS_LIMIT = 15;

function eventBodyPreview(body: string | null | undefined): string {
  return (body ?? "").replace(/\s+/g, " ").trim();
}

function sortEventsByTimeDesc(events: AnalysisEvent[]): AnalysisEvent[] {
  return [...events].sort(
    (a, b) =>
      new Date(getEventTimestamp(b)).getTime() - new Date(getEventTimestamp(a)).getTime(),
  );
}

/** Events list: title + body + time (no channel/source line). */
export function EventsBoardWidget({ active = true, widgetId }: BoardWidgetProps) {
  const { t } = useTranslation();
  const selectedEvent = useSyncExternalStore(
    subscribeBoardFocus,
    getBoardFocusTarget,
    getBoardFocusTarget,
  );
  const selectedRowRef = useRef<HTMLButtonElement | null>(null);
  const { selection, setSelection, filterBySource } = useBoardSourceFilter(widgetId);
  const fetcher = useCallback(
    () =>
      Promise.all([
        fetchEvents({
          limit: EVENTS_LIMIT,
          offset: 0,
          sort: "analyzed_at",
          includeTotal: false,
        }).then((page) => page.items),
        // Unbounded list stays small under retention; merge so「一般」filter works.
        listUserEvents(),
      ]).then(([analysisEvents, userEvents]) =>
        sortEventsByTimeDesc([
          ...analysisEvents,
          ...userEvents.map((event) => userEventToBoardEvent(event)),
        ]),
      ),
    [],
  );
  const { data: fetchedItems, error, loading, refresh } = useBoardWidgetPoll<AnalysisEvent[]>(
    fetcher,
    BOARD_POLL_MS.standard,
    { active },
  );
  const { tasks, worksets } = useTaskCatalog();
  const taskNameById = useTaskNameById();
  const worksetNameById = useWorksetNameById();
  const generalWorksetLabel = useGeneralWorksetLabel();
  // Without this the badge on a tagged user_event renders its raw task id.
  const items = useMemo(
    () =>
      fetchedItems
        ? withResolvedUserEventTaskNames(
            fetchedItems,
            taskNameById,
            generalWorksetLabel,
            worksetNameById,
          )
        : null,
    [fetchedItems, taskNameById, generalWorksetLabel, worksetNameById],
  );
  const filterOptions = useMemo(
    () => catalogOrEventSourceOptions(tasks, items),
    [items, tasks],
  );
  // Filter first so「一般」is not squeezed out of the recent-15 cap.
  const filteredItems = useMemo(
    () => sortEventsByTimeDesc(filterBySource(items ?? [])).slice(0, EVENTS_LIMIT),
    [filterBySource, items],
  );
  const headerActions = useMemo(
    () => (
      <SourceFilterDialog
        tasks={filterOptions}
        worksets={worksets.map((ws) => ({
          id: ws.id,
          name: ws.id === SYSTEM_WORKSET_ID ? generalWorksetLabel : ws.name,
          isSystem: ws.isSystem,
        }))}
        expandTasks={tasks.map((task) => ({
          id: task.id,
          name: task.name,
          worksetId: task.worksetId ?? null,
        }))}
        selection={selection}
        onChange={setSelection}
        ariaLabelPrefix={t("board.events.ariaPrefix")}
        variant="board"
      />
    ),
    [filterOptions, selection, setSelection, t, tasks, generalWorksetLabel, worksets],
  );
  useBoardWidgetHeaderActions(headerActions);

  // A map marker or another event-oriented frame selects the matching row
  // locally; no route change is needed to reveal the event context.
  useEffect(() => {
    const row = selectedRowRef.current;
    if (row && typeof row.scrollIntoView === "function") {
      row.scrollIntoView({ block: "nearest" });
    }
  }, [selectedEvent]);

  return (
    <div className="board-widget-body" data-testid="board-events-widget">
      <BoardWidgetShell
        loading={loading && !items}
        error={!items ? error : null}
        onRetry={refresh}
        empty={Array.isArray(items) && filteredItems.length === 0}
        emptyLabel={
          isEmptySourceFilter(selection)
            ? t("board.common.noTaskSelected")
            : t("board.events.empty")
        }
      >
        {filteredItems.length > 0 ? (
          <ul className="board-widget-list">
            {filteredItems.map((item) => {
              const body = eventBodyPreview(item.body);
              return (
                <li key={item.id} className="board-widget-list__item">
                  <button
                    type="button"
                    className="board-widget-list__row board-events-row"
                    data-testid={`board-events-row-${item.id}`}
                    ref={selectedEvent?.eventId === item.id ? selectedRowRef : null}
                    aria-pressed={selectedEvent?.eventId === item.id}
                    onClick={() => {
                      focusBoardEvent({
                        eventId: item.id,
                        title: item.title || untitledLabel(),
                        body: item.body,
                        location: item.location,
                        ...(isMappableCoordinate(item.latitude, item.longitude)
                          ? { lat: item.latitude, lon: item.longitude! }
                          : {}),
                      });
                    }}
                  >
                    <span className="board-events-row__title">
                      <span className="board-widget-list__primary">
                        {item.title || untitledLabel()}
                      </span>
                      {item.taskName ? (
                        <Badge tone="neutral" className="board-events-row__badge">
                          {item.taskName}
                        </Badge>
                      ) : null}
                    </span>
                    {body ? <span className="board-events-row__body">{body}</span> : null}
                    <span className="board-widget-list__meta">
                      {formatIntelligenceEventTime(item)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </BoardWidgetShell>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "../../components/ui";
import { formatIntelligenceEventTime } from "../../domain/intelligence/intelligenceSourceMeta";
import { isMappableCoordinate } from "../../domain/intelligence/mapFilters";
import {
  fetchBoardEventsList,
  sortEventsByTimeDesc,
} from "../../domain/timeline/timedEventMerge";
import { BoardWidgetShell } from "../BoardWidgetStatus";
import { useBoardTimedEventsWidget } from "../useBoardTimedEventsWidget";
import { BOARD_POLL_MS } from "../useBoardWidgetPoll";
import {
  focusBoardEvent,
  getBoardFocusTarget,
  subscribeBoardFocus,
} from "../boardFocusStore";
import type { BoardWidgetProps } from "../types";
import { untitledLabel } from "../boardLabels";
import { isEmptySourceFilter } from "../../domain/tasks/sourceFilterSelection";

const EVENTS_LIMIT = 15;

function eventBodyPreview(body: string | null | undefined): string {
  return (body ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Events list: merged calendar/window occurrences (analysis / user / recurring /
 * item_remind) for the padded month, newest first.
 */
export function EventsBoardWidget({ active = true, widgetId }: BoardWidgetProps) {
  const { t } = useTranslation();
  const selectedEvent = useSyncExternalStore(
    subscribeBoardFocus,
    getBoardFocusTarget,
    getBoardFocusTarget,
  );
  const selectedRowRef = useRef<HTMLButtonElement | null>(null);
  const fetcher = useCallback(
    () => fetchBoardEventsList({ limit: EVENTS_LIMIT }),
    [],
  );
  const { selection, events: items, filteredEvents, loading, error, refresh } =
    useBoardTimedEventsWidget({
      widgetId: widgetId ?? "events",
      active,
      fetcher,
      pollMs: BOARD_POLL_MS.standard,
      ariaLabelPrefix: t("board:events.ariaPrefix"),
    });
  // Filter first so「一般」is not squeezed out of the recent-15 cap.
  const cappedItems = useMemo(
    () => sortEventsByTimeDesc(filteredEvents).slice(0, EVENTS_LIMIT),
    [filteredEvents],
  );

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
        empty={Array.isArray(items) && cappedItems.length === 0}
        emptyLabel={
          isEmptySourceFilter(selection)
            ? t("board:common.noTaskSelected")
            : t("board:events.empty")
        }
      >
        {cappedItems.length > 0 ? (
          <ul className="board-widget-list">
            {cappedItems.map((item) => {
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

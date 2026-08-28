import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";

import { useTranslation } from "react-i18next";

import { dismissTimelineEvent, timelineItemDismissalSource } from "../../api/timelineDismissals";

import { EventListRow } from "../../components/timeline/EventListRow";

import { isMappableCoordinate } from "../../domain/intelligence/mapFilters";

import { useEventListMetaLookups } from "../../domain/timeline/useEventListMetaLookups";

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

import type { TimelineItem } from "../../types";
import { asTimedAnalysisEvent } from "../../types/timelineItem";



const EVENTS_LIMIT = 15;



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

  const selectedRowRef = useRef<HTMLDivElement | null>(null);

  const [dismissBusyId, setDismissBusyId] = useState<string | null>(null);

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

  const metaLookups = useEventListMetaLookups();



  // Filter first so「一般」is not squeezed out of the recent-15 cap.

  const cappedItems = useMemo(
    () =>
      sortEventsByTimeDesc(filteredEvents)
        .filter((event) => !event.dismissed)
        .map(asTimedAnalysisEvent)
        .filter((event): event is TimelineItem => event != null)
        .slice(0, EVENTS_LIMIT),
    [filteredEvents],
  );



  useEffect(() => {

    const row = selectedRowRef.current;

    if (row && typeof row.scrollIntoView === "function") {

      row.scrollIntoView({ block: "nearest" });

    }

  }, [selectedEvent]);



  const handleDismiss = useCallback(

    async (event: TimelineItem) => {

      setDismissBusyId(event.id);

      try {

        await dismissTimelineEvent(timelineItemDismissalSource(event.source), event.id);

        refresh();

      } finally {

        setDismissBusyId(null);

      }

    },

    [refresh],

  );



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

            {cappedItems.map((item) => (

              <li key={item.id} className="board-widget-list__item">

                <div ref={selectedEvent?.eventId === item.id ? selectedRowRef : null}>

                  <EventListRow

                    event={item}

                    metaLookups={metaLookups}

                    selected={selectedEvent?.eventId === item.id}

                    dismissBusy={dismissBusyId === item.id}

                    testId={`board-events-row-${item.id}`}

                    onSelect={() => {

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

                    onDismiss={() => void handleDismiss(item)}

                  />

                </div>

              </li>

            ))}

          </ul>

        ) : null}

      </BoardWidgetShell>

    </div>

  );

}


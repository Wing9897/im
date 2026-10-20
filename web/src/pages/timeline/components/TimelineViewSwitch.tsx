/**
 * Timeline view switch — calendar/gantt grids stay visible even with zero events.
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { isCalendarShareUnreachable } from "../../../domain/calendarShare/subscribedCalendars";
import { useErrorToast } from "../../../hooks/useErrorToast";
import { TimelineGrid } from "../calendar/TimelineGrid";
import { TimelineSidebar } from "./TimelineSidebar";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { TimelineEmptyHint } from "./TimelineEmptyHint";
import { useTimelinePageContext } from "../TimelinePageContext";
import { useTimelineLoadTimeout } from "../useTimelineLoadTimeout";
import { resolveTimelineEmptyHint } from "../timelineViewModel";
import {
  timelineContentRowClass,
  timelineGridColumnClass,
  timelineMainLayoutClass,
  timelineSidebarColumnClass,
} from "../timelineViewLayout";

interface TimelineViewSwitchProps {
  error?: string | null;
}

export function TimelineViewSwitch({ error }: TimelineViewSwitchProps = {}) {
  const { t } = useTranslation("timeline");
  const {
    onSelectEvent,
    eventStatuses,
    selectedEvent,
    selectedGanttSpan,
    onCloseGanttPanel,
    monthLayout = "unified",
    navigation,
    chrome,
  } = useTimelinePageContext();
  const {
    initialLoading,
    isRefreshing: _isRefreshing,
    events,
    filteredEvents,
    emptyState,
    timeScale,
    rangeStart,
    rangeEvents,
    sidebarEvents,
    weekDays,
    timeCursor,
    monthCursor,
    monthDays,
    monthEvents,
    focusedDay,
    onFocusDay,
    sidebarDay,
    sidebarOutOfView,
  } = navigation;
  const { viewMode } = chrome;

  const hideDayEventSidebar =
    viewMode === "calendar" &&
    timeScale === "month" &&
    monthLayout === "split" &&
    !selectedEvent;

  const hasEvents = events.length > 0;
  const { timedOut } = useTimelineLoadTimeout(initialLoading, hasEvents);
  const effectiveError = timedOut ? t("view.loadTimeout") : error ?? null;
  useErrorToast(isCalendarShareUnreachable(effectiveError) ? null : effectiveError);

  const emptyHint = useMemo(
    () => resolveTimelineEmptyHint(events, filteredEvents, emptyState, t),
    [events, filteredEvents, emptyState, t],
  );

  // Keep the grid mounted while loading so the sticky toolbar / layout do not jump.
  // Loading spinner lives in TimelineControlBar.
  return (
    <div className={timelineMainLayoutClass} data-testid="timeline-main-layout">
      {emptyHint && <TimelineEmptyHint hint={emptyHint} />}

      <div className={timelineContentRowClass}>
        <div className={timelineGridColumnClass}>
          <TimelineGrid
            viewMode={viewMode}
            timeScale={timeScale}
            rangeStart={rangeStart}
            rangeEvents={rangeEvents}
            weekDays={weekDays}
            timeCursor={timeCursor}
            monthCursor={monthCursor}
            monthDays={monthDays}
            monthEvents={monthEvents}
            focusedDay={focusedDay}
            eventStatuses={eventStatuses}
            onSelectEvent={onSelectEvent}
            onFocusDay={onFocusDay}
          />
        </div>

        {hideDayEventSidebar ? null : (
          <div className={timelineSidebarColumnClass} data-testid="timeline-event-sidebar">
            {viewMode === "gantt" && selectedGanttSpan ? (
              <TaskDetailPanel span={selectedGanttSpan} onClose={onCloseGanttPanel} />
            ) : (
              <TimelineSidebar
                rangeEvents={sidebarEvents}
                focusedDay={sidebarDay ?? focusedDay}
                outOfView={sidebarOutOfView}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

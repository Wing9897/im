/**
 * Timeline view switch — calendar/gantt grids stay visible even with zero events.
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { RefreshIndicator } from "../../../components/common/RefreshIndicator";
import type { TimelineScale } from "../../../domain/timeline/dateUtils";
import { useErrorToast } from "../../../hooks/useErrorToast";
import type { TimelineItem } from "../../../types";
import { TimelineGrid } from "../calendar/TimelineGrid";
import { TimelineSidebar } from "./TimelineSidebar";
import { TaskDetailPanel } from "./TaskDetailPanel";
import { TimelineSkeleton } from "./TimelineSkeleton";
import { TimelineEmptyHint } from "./TimelineEmptyHint";
import { useTimelinePageContext } from "../TimelinePageContext";
import { useTimelineLoadTimeout } from "../useTimelineLoadTimeout";
import { resolveTimelineEmptyHint } from "../timelineViewModel";
import {
  timelineContentRowClass,
  timelineGridColumnClass,
  timelineMainLayoutClass,
  timelineRefreshRowClass,
  timelineSidebarColumnClass,
} from "../timelineViewLayout";

interface TimelineViewSwitchProps {
  initialLoading: boolean;
  isRefreshing: boolean;
  events: TimelineItem[];
  filteredEvents: TimelineItem[];
  emptyState: string;
  viewMode: "calendar" | "gantt";
  timeScale: TimelineScale;
  rangeStart: Date;
  rangeEvents: TimelineItem[];
  sidebarEvents: TimelineItem[];
  weekDays: Date[];
  timeCursor: Date;
  monthCursor: Date;
  monthDays: Date[];
  monthEvents: TimelineItem[];
  focusedDay: Date | null;
  onFocusDay: (day: Date) => void;
  error?: string | null;
}

export function TimelineViewSwitch({
  initialLoading,
  isRefreshing,
  events,
  filteredEvents,
  emptyState,
  viewMode,
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
  error,
}: TimelineViewSwitchProps) {
  const { t } = useTranslation("timeline");
  const {
    onSelectEvent,
    eventStatuses,
    selectedGanttSpan,
    onCloseGanttPanel,
  } = useTimelinePageContext();

  const hasEvents = events.length > 0;
  const { timedOut } = useTimelineLoadTimeout(initialLoading, hasEvents);
  const effectiveError = timedOut ? t("view.loadTimeout") : error ?? null;
  useErrorToast(effectiveError);

  const emptyHint = useMemo(
    () => resolveTimelineEmptyHint(events, filteredEvents, emptyState, t),
    [events, filteredEvents, emptyState, t],
  );

  if (initialLoading && !hasEvents && !timedOut) {
    return <TimelineSkeleton viewMode={viewMode} />;
  }

  return (
    <div className={timelineMainLayoutClass} data-testid="timeline-main-layout">
      {emptyHint && <TimelineEmptyHint hint={emptyHint} />}

      {isRefreshing && (
        <div className={`${timelineRefreshRowClass} shrink-0`} data-testid="timeline-refresh-indicator">
          <RefreshIndicator label={t("view.refreshing")} />
        </div>
      )}

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

        <div className={timelineSidebarColumnClass}>
          {viewMode === "gantt" && selectedGanttSpan ? (
            <TaskDetailPanel span={selectedGanttSpan} onClose={onCloseGanttPanel} />
          ) : (
            <TimelineSidebar
              rangeEvents={sidebarEvents}
              allRangeEvents={rangeEvents}
              hasDayFocus={sidebarEvents !== rangeEvents}
              focusedDay={focusedDay}
            />
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { FilterChip } from "../../../components/ui";
import { captionClass } from "../../../components/ui/pageTypography";
import {
  filterSidebarDayGroups,
  groupSidebarDayEvents,
  type SidebarDayPhaseFilter,
} from "../../../domain/timeline/eventTimePhase";
import { startOfDay } from "../../../domain/timeline/dateUtils";
import { useEventListMetaLookups } from "../../../domain/timeline/useEventListMetaLookups";
import type { TimelineItem } from "../../../types";
import { resolveSidebarDay } from "../timelinePageUtils";
import { EventListEmpty } from "./EventListEmpty";
import { EventListGroup } from "./EventListGroup";

const PHASE_FILTERS = [
  ["all", "eventList.filterAll"],
  ["ongoing", "eventList.filterOngoing"],
  ["upcoming", "eventList.filterUpcoming"],
] as const;

/**
 * Right-hand event list: always scoped to one local day (selected day, default today).
 * Quick filters: 全部 + 进行中 / 未开始 (vs **real now** only).
 * Card tags: 跨日进行中 + 结束于本日/当日 (aligned with month +N chips).
 */
export function EventListPanel({
  rangeEvents,
  focusedDay,
  onSelectEvent,
  outOfView = false,
}: {
  /** Day-filtered events for the sidebar (from {@link computeSidebarEvents}). */
  rangeEvents: TimelineItem[];
  focusedDay: Date | null;
  onSelectEvent: (event: TimelineItem | null) => void;
  /** Focused day is outside the visible 全局 window; list follows the window center. */
  outOfView?: boolean;
}) {
  const { t } = useTranslation("timeline");
  const metaLookups = useEventListMetaLookups();
  const day = resolveSidebarDay(focusedDay);
  const dayKey = startOfDay(day).getTime();
  const [phaseFilter, setPhaseFilter] = useState<SidebarDayPhaseFilter>("all");

  useEffect(() => {
    setPhaseFilter("all");
  }, [dayKey]);

  const groups = filterSidebarDayGroups(
    groupSidebarDayEvents(rangeEvents),
    phaseFilter,
  );
  const visibleCount = groups.ongoing.length + groups.upcoming.length;
  const dayLabel = startOfDay(day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-md overflow-hidden">
      <div
        className="flex w-full shrink-0 flex-wrap items-center justify-between gap-x-sm gap-y-1.5"
        data-testid="timeline-event-list-header"
      >
        {rangeEvents.length > 0 ? (
          <div
            className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"
            role="group"
            aria-label={t("eventList.phaseFilterAria")}
            data-testid="timeline-event-phase-filter"
          >
            {PHASE_FILTERS.map(([id, labelKey]) => (
              <FilterChip
                key={id}
                size="sm"
                active={phaseFilter === id}
                onClick={() => setPhaseFilter(id)}
                data-testid={`timeline-event-phase-filter-${id}`}
              >
                {t(labelKey)}
              </FilterChip>
            ))}
          </div>
        ) : (
          <span className="min-w-0 flex-1" aria-hidden="true" />
        )}
        <p
          className={`${captionClass} m-0 shrink-0 self-center font-medium tabular-nums`}
          data-testid="timeline-event-list-day-label"
        >
          {dayLabel}
          {outOfView ? (
            <span
              className="ml-1.5 font-normal opacity-80"
              data-testid="timeline-event-list-out-of-view"
            >
              {t("eventList.outOfView")}
            </span>
          ) : null}
        </p>
      </div>
      <div
        className="im-auto-scrollbar im-timeline-event-list flex min-h-0 min-w-0 flex-1 flex-col gap-md overflow-x-hidden overflow-y-auto"
        data-testid="timeline-event-list-scroll"
      >
        {rangeEvents.length === 0 ? (
          <EventListEmpty filtered={false} />
        ) : visibleCount === 0 ? (
          <EventListEmpty filtered />
        ) : (
          <>
            <EventListGroup
              title={t("eventList.filterOngoing")}
              events={groups.ongoing}
              focusedDay={day}
              onSelectEvent={onSelectEvent}
              testId="timeline-event-group-ongoing"
              metaLookups={metaLookups}
            />
            <EventListGroup
              title={t("eventList.filterUpcoming")}
              events={groups.upcoming}
              focusedDay={day}
              onSelectEvent={onSelectEvent}
              testId="timeline-event-group-upcoming"
              metaLookups={metaLookups}
            />
          </>
        )}
      </div>
    </div>
  );
}

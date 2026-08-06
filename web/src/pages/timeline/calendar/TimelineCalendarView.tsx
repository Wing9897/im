import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MapPin } from "lucide-react";

import { Badge } from "../../../components/ui";
import {
  itemDateKindLabel,
  itemDateKindMarkerClass,
} from "../../../domain/items/itemCalendarProjection";
import {
  eventStartsOnDay,
  formatTimeLabel,
  formatWeekdayLabel,
  isSameDay,
  isToday,
  type TimelineScale,
} from "../../../domain/timeline/dateUtils";
import {
  EVENT_LIST_DAY_PHASE_TAG_CLASS,
  EVENT_LIST_DAY_PHASE_TAG_META,
  calendarLocationDisplay,
  resolveEventCardDisplay,
} from "../../../domain/timeline/eventListCardMeta";
import {
  getEventStatusColor,
  getEventStatusLabel,
  type TimelineEventStatus,
  type TimelineEventStatusMap,
} from "../../../domain/timeline/status";
import type { DailyWeather } from "../../../hooks/useMonthWeather";
import type { TimelineItem } from "../../../types";
import {
  preferActiveEvents,
  sortActiveThenDismissed,
  dismissedSurfaceClass,
  dismissedTitleClass,
} from "../timelineDismissUtils";
import {
  calendarDayEventsGridClass,
  calendarDayGridClass,
  calendarDayHeaderClass,
  dayCardAccentRailClass,
  dayCardBodyClass,
  dayCardInnerClass,
  dayCardLocationIconClass,
  dayCardLocationRowClass,
  dayCardLocationTextClass,
  dayCardMetadataClass,
  dayCardPrimaryRowClass,
  dayCardSummaryClass,
  dayCardTimeChipClass,
  dayCardTitleClass,
  dayEventCardClass,
  dayViewEmptyClass,
  weekCellDateClass,
  weekCellEmptyClass,
  weekCellEventsContainerClass,
  weekCellEventCountClass,
  weekCellHeaderClass,
  weekCellMetaRowClass,
  weekCellTodayLabelClass,
  weekEventChipBodyClass,
  weekEventChipClass,
  weekEventChipInnerClass,
  weekEventChipRailClass,
  weekEventChipTimeClass,
  weekEventChipTitleClass,
  weekViewDayGridClass,
  weekViewHeaderGridClass,
  weekViewWeekdayLabelClass,
  getWeekCellClass,
} from "./calendarCellClasses";
import {
  calendarScrollableClass,
  monthCalendarFillClass,
} from "./timelineCalendarLayout";
import { TimelineMonthGrid } from "./TimelineMonthGrid";
import { TimelineWeatherChip } from "./TimelineWeatherChip";

type TimelineCalendarViewProps = {
  timeScale: TimelineScale;
  rangeStart: Date;
  rangeEvents: TimelineItem[];
  weekDays: Date[];
  timeCursor: Date;
  monthCursor: Date;
  monthDays: Date[];
  monthEvents: TimelineItem[];
  focusedDay: Date | null;
  eventStatuses: TimelineEventStatusMap;
  /** Include soft-dismissed events in day cells (product default true). */
  showDismissed?: boolean;
  /** Show month-cell「+N ongoing」span chips (product default true). */
  showOngoing?: boolean;
  /** Show month-cell「+N ending」span chips (product default true). */
  showEnding?: boolean;
  /** Month daily weather keyed by local YYYY-MM-DD (from page-level useMonthWeather). */
  weatherByDate?: Record<string, DailyWeather>;
  onSelectEvent: (event: TimelineItem) => void;
  onFocusDay: (day: Date) => void;
  onCreateOnDay?: (day: Date) => void;
};

export function TimelineCalendarView({
  timeScale,
  rangeStart,
  rangeEvents,
  weekDays,
  timeCursor,
  monthCursor,
  monthDays,
  monthEvents,
  focusedDay,
  eventStatuses,
  showDismissed = true,
  showOngoing = true,
  showEnding = true,
  weatherByDate = {},
  onSelectEvent,
  onFocusDay,
  onCreateOnDay,
}: TimelineCalendarViewProps) {
  const { t } = useTranslation("timeline");

  if (timeScale === "day") {
    return (
      <div className={calendarScrollableClass}>
        <div className={calendarDayGridClass}>
          <div className={`${calendarDayHeaderClass} flex flex-wrap items-center gap-sm`}>
            <span>{formatWeekdayLabel(rangeStart)}</span>
            <TimelineWeatherChip
              day={rangeStart}
              weatherByDate={weatherByDate}
              testId="timeline-day-weather"
            />
          </div>
          <div className={calendarDayEventsGridClass}>
            {rangeEvents.length === 0 ? (
              <div className={dayViewEmptyClass}>
                {t("calendar.noEventsToday")}
              </div>
            ) : (
              sortActiveThenDismissed(rangeEvents).map((event) => (
                <DayEventCard
                  key={event.id}
                  event={event}
                  focusedDay={rangeStart}
                  status={eventStatuses[event.id] ?? "pending"}
                  onSelect={onSelectEvent}
                />
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  if (timeScale === "week") {
    return (
      <div className={calendarScrollableClass} data-testid="timeline-week-view">
        <div>
          <div className={weekViewHeaderGridClass}>
            {weekDays.map((day) => (
              <div key={day.toISOString()} className={weekViewWeekdayLabelClass}>
                <div className="flex flex-wrap items-center justify-center gap-1">
                  <span>{formatWeekdayLabel(day)}</span>
                  <TimelineWeatherChip
                    day={day}
                    weatherByDate={weatherByDate}
                    testId="timeline-day-weather"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className={weekViewDayGridClass}>
            {weekDays.map((day) => {
              const dayEvents = preferActiveEvents(
                rangeEvents.filter((event) => eventStartsOnDay(event, day)),
                { showDismissed },
              );
              const activeDay = isSameDay(day, timeCursor) || (focusedDay != null && isSameDay(day, focusedDay));
              const today = isToday(day);
              return (
                <div
                  key={day.toISOString()}
                  role="button"
                  tabIndex={0}
                  onClick={() => onFocusDay(day)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onFocusDay(day);
                    }
                  }}
                  className={getWeekCellClass({ isActive: activeDay, isToday: today })}
                  data-testid="timeline-week-day-cell"
                >
                  <div className={weekCellHeaderClass}>
                    <div className={weekCellDateClass(today)}>
                      {day.getDate()}
                    </div>
                    <div className={weekCellMetaRowClass}>
                      {today && (
                        <span className={weekCellTodayLabelClass}>{t("calendar.today")}</span>
                      )}
                      <span className={weekCellEventCountClass}>
                        {t("calendar.itemCount", { count: dayEvents.length })}
                      </span>
                    </div>
                  </div>
                  <div className={weekCellEventsContainerClass}>
                    {dayEvents.length === 0 ? (
                      <div className={weekCellEmptyClass}>
                        {t("calendar.noEvents")}
                      </div>
                    ) : (
                      dayEvents.map((event) => (
                        <WeekEventChip
                          key={event.id}
                          event={event}
                          focusedDay={day}
                          status={eventStatuses[event.id] ?? "pending"}
                          onSelect={onSelectEvent}
                        />
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={monthCalendarFillClass}>
      <TimelineMonthGrid
        timeCursor={timeCursor}
        monthCursor={monthCursor}
        monthDays={monthDays}
        monthEvents={monthEvents}
        focusedDay={focusedDay}
        showDismissed={showDismissed}
        showOngoing={showOngoing}
        showEnding={showEnding}
        weatherByDate={weatherByDate}
        onSelectEvent={onSelectEvent}
        onFocusDay={onFocusDay}
        onCreateOnDay={onCreateOnDay}
      />
    </div>
  );
}

type DayEventCardProps = {
  event: TimelineItem;
  focusedDay: Date;
  status: TimelineEventStatus;
  onSelect: (event: TimelineItem) => void;
};

function dayCardTimeLabel(
  event: TimelineItem,
  allDayLabel: string,
): string {
  if (event.isAllDay) return allDayLabel;
  const start = formatTimeLabel(new Date(event.startTime));
  if (!event.endTime) return start;
  const endDate = new Date(event.endTime);
  if (Number.isNaN(endDate.getTime()) || endDate.getTime() <= new Date(event.startTime).getTime()) {
    return start;
  }
  return `${start} – ${formatTimeLabel(endDate)}`;
}

type WeekEventChipProps = {
  event: TimelineItem;
  focusedDay: Date;
  status: TimelineEventStatus;
  onSelect: (event: TimelineItem) => void;
};

function WeekEventChip({ event, focusedDay, status, onSelect }: WeekEventChipProps) {
  const { t } = useTranslation("timeline");
  const [hovered, setHovered] = useState(false);
  const dismissed = Boolean(event.dismissed);
  const statusColor = getEventStatusColor(status);
  const { leading, showRemindBadge, dayPhaseTag, title } =
    resolveEventCardDisplay(event, focusedDay);
  const timeLabel = dayCardTimeLabel(event, t("userEvent.allDay"));

  return (
    <button
      type="button"
      onClick={(clickEvent) => {
        clickEvent.stopPropagation();
        onSelect(event);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`${weekEventChipClass(hovered)} ${dismissed ? dismissedSurfaceClass : ""}`}
      data-testid="timeline-week-event-chip"
      title={title}
    >
      <div className={weekEventChipInnerClass}>
        <span
          className={weekEventChipRailClass}
          style={{ backgroundColor: statusColor }}
          aria-hidden="true"
        />
        <div className={weekEventChipBodyClass}>
          <div className="flex min-w-0 items-start gap-0.5">
            <div
              className={`${weekEventChipTitleClass} min-w-0 flex-1 ${
                dismissed ? dismissedTitleClass : ""
              }`}
            >
              {leading ? (
                <span
                  className={`mr-0.5 inline-flex align-middle ${itemDateKindMarkerClass(
                    leading.type === "item" ? leading.itemDateKind : null,
                  )}`}
                  aria-hidden="true"
                  data-testid={
                    leading.type === "important"
                      ? "week-important-marker"
                      : "week-item-kind-marker"
                  }
                >
                  {leading.emoji}
                </span>
              ) : null}
              {title}
            </div>
            {showRemindBadge ? (
              <Badge
                tone="warning"
                className="normal-case tracking-normal shrink-0 !px-1 !py-0 text-[9px] leading-none"
                data-testid="timeline-remind-badge"
              >
                {itemDateKindLabel("remind")}
              </Badge>
            ) : null}
            {dayPhaseTag ? (
              <span
                className={EVENT_LIST_DAY_PHASE_TAG_CLASS}
                data-testid={EVENT_LIST_DAY_PHASE_TAG_META[dayPhaseTag].testId}
              >
                {t(EVENT_LIST_DAY_PHASE_TAG_META[dayPhaseTag].labelKey)}
              </span>
            ) : null}
          </div>
          <div className={weekEventChipTimeClass}>{timeLabel}</div>
        </div>
      </div>
    </button>
  );
}

function DayEventCard({ event, focusedDay, status, onSelect }: DayEventCardProps) {
  const { t } = useTranslation("timeline");
  const [hovered, setHovered] = useState(false);
  const dismissed = Boolean(event.dismissed);
  const statusColor = getEventStatusColor(status);
  const location = calendarLocationDisplay(event.location);
  const { leading, showRemindBadge, dayPhaseTag, title } =
    resolveEventCardDisplay(event, focusedDay);
  const timeLabel = dayCardTimeLabel(event, t("userEvent.allDay"));

  return (
    <button
      type="button"
      onClick={() => onSelect(event)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`${dayEventCardClass(hovered)} ${dismissed ? dismissedSurfaceClass : ""}`}
      data-testid="timeline-day-event-card"
    >
      <div className={dayCardInnerClass}>
        <span
          className={dayCardAccentRailClass}
          style={{ backgroundColor: statusColor }}
          aria-hidden="true"
        />
        <div className={dayCardBodyClass}>
          <div className={dayCardPrimaryRowClass}>
            <div
              className={`${dayCardTitleClass} ${
                dismissed ? dismissedTitleClass : ""
              }`}
              title={title}
            >
              {leading ? (
                <span
                  className={`mr-1 inline-flex align-middle ${itemDateKindMarkerClass(
                    leading.type === "item" ? leading.itemDateKind : null,
                  )}`}
                  aria-hidden="true"
                  data-testid={
                    leading.type === "important"
                      ? "day-important-marker"
                      : "day-item-kind-marker"
                  }
                >
                  {leading.emoji}
                </span>
              ) : null}
              {title}
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
              {showRemindBadge ? (
                <Badge
                  tone="warning"
                  className="normal-case tracking-normal shrink-0"
                  data-testid="timeline-remind-badge"
                >
                  {itemDateKindLabel("remind")}
                </Badge>
              ) : null}
              {dayPhaseTag ? (
                <span
                  className={EVENT_LIST_DAY_PHASE_TAG_CLASS}
                  data-testid={EVENT_LIST_DAY_PHASE_TAG_META[dayPhaseTag].testId}
                >
                  {t(EVENT_LIST_DAY_PHASE_TAG_META[dayPhaseTag].labelKey)}
                </span>
              ) : null}
              <div className={dayCardTimeChipClass}>{timeLabel}</div>
            </div>
          </div>
          {event.body ? (
            <div className={dayCardSummaryClass} title={event.body}>
              {event.body}
            </div>
          ) : null}
          <div
            className={dayCardLocationRowClass}
            data-testid="timeline-day-event-location"
          >
            <MapPin
              size={12}
              strokeWidth={2}
              className={dayCardLocationIconClass}
              aria-hidden="true"
            />
            <span className={dayCardLocationTextClass} title={location}>
              {t("calendar.location", { value: location })}
            </span>
          </div>
          <div className={dayCardMetadataClass}>
            <span style={{ color: statusColor }}>
              {getEventStatusLabel(status)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

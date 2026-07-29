import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TimelineItem } from "../../../types";
import {
  eventStartsOnDay,
  formatTimeLabel,
  formatWeekdayLabel,
  isSameDay,
  isToday,
  type TimelineScale,
} from "../../../domain/timeline/dateUtils";
import {
  getEventStatusColor,
  getEventStatusLabel,
  type TimelineEventStatus,
  type TimelineEventStatusMap,
} from "../../../domain/timeline/status";
import { TimelineEventCard } from "../components/TimelineEventCard";
import { preferActiveEvents, sortActiveThenDismissed, dismissedSurfaceClass, dismissedTitleClass } from "../timelineDismissUtils";
import { TimelineMonthGrid } from "./TimelineMonthGrid";
import { useMonthWeather } from "../../../hooks/useMonthWeather";
import { useErrorToast } from "../../../hooks/useErrorToast";
import {
  calendarScrollableClass,
  monthCalendarFillClass,
} from "./timelineCalendarLayout";
import {
  calendarDayEventsGridClass,
  calendarDayGridClass,
  calendarDayHeaderClass,
  dayCardMetadataClass,
  dayCardPrimaryRowClass,
  dayCardSummaryClass,
  dayEventCardClass,
  dayViewEmptyClass,
  weekCellDateClass,
  weekCellEmptyClass,
  weekCellEventsContainerClass,
  weekCellEventCountClass,
  weekCellHeaderClass,
  weekCellMetaRowClass,
  weekCellTodayLabelClass,
  weekViewDayGridClass,
  weekViewHeaderGridClass,
  weekViewWeekdayLabelClass,
  getWeekCellClass,
} from "./calendarCellClasses";

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
  onSelectEvent: (event: TimelineItem) => void;
  onFocusDay: (day: Date) => void;
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
  onSelectEvent,
  onFocusDay,
}: TimelineCalendarViewProps) {
  const { t } = useTranslation("timeline");
  const { weatherByDate, error: weatherError } = useMonthWeather(timeScale === "month", monthDays);
  useErrorToast(weatherError);

  if (timeScale === "day") {
    return (
      <div className={calendarScrollableClass}>
        <div className={calendarDayGridClass}>
          <div className={calendarDayHeaderClass}>
            {formatWeekdayLabel(rangeStart)}
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
      <div className={calendarScrollableClass}>
        <div>
          <div className={weekViewHeaderGridClass}>
            {weekDays.map((day) => (
              <div key={day.toISOString()} className={weekViewWeekdayLabelClass}>
                {formatWeekdayLabel(day)}
              </div>
            ))}
          </div>
          <div className={weekViewDayGridClass}>
            {weekDays.map((day) => {
              const dayEvents = preferActiveEvents(
                rangeEvents.filter((event) => eventStartsOnDay(event, day)),
                { showDismissed },
              );
              const onlyDismissed =
                dayEvents.length > 0 && dayEvents.every((event) => Boolean(event.dismissed));
              const activeDay = isSameDay(day, timeCursor);
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
                        <TimelineEventCard
                          key={event.id}
                          event={event}
                          status={eventStatuses[event.id] ?? "pending"}
                          onSelect={onSelectEvent}
                          stopPropagation
                          forceDismissedStyle={onlyDismissed || Boolean(event.dismissed)}
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
      />
    </div>
  );
}

type DayEventCardProps = {
  event: TimelineItem;
  status: TimelineEventStatus;
  onSelect: (event: TimelineItem) => void;
};

function DayEventCard({ event, status, onSelect }: DayEventCardProps) {
  const [hovered, setHovered] = useState(false);
  const dismissed = Boolean(event.dismissed);

  return (
    <button
      type="button"
      onClick={() => onSelect(event)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={`${dayEventCardClass(hovered)} ${dismissed ? dismissedSurfaceClass : ""}`}
    >
      <div className={dayCardPrimaryRowClass}>
        <div
          className={`font-bold ${
            dismissed ? dismissedTitleClass : ""
          }`}
        >
          {event.title}
        </div>
        <div className="flex shrink-0 items-center gap-sm">
          <div className="text-xs text-text-muted">
            {formatTimeLabel(new Date(event.startTime))}
          </div>
        </div>
      </div>
      {event.body && (
        <div className={dayCardSummaryClass}>
          {event.body}
        </div>
      )}
      <div className={dayCardMetadataClass}>
        <span style={{ color: getEventStatusColor(status) }}>
          {getEventStatusLabel(status)}
        </span>
      </div>
    </button>
  );
}

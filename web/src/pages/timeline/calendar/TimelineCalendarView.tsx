import { useTranslation } from "react-i18next";

import {
  eventStartsOnDay,
  formatWeekdayLabel,
  isSameDay,
  isToday,
  type TimelineScale,
} from "../../../domain/timeline/dateUtils";
import type { DailyHoliday } from "../../../hooks/useMonthHolidays";
import type { DailyWeather } from "../../../hooks/useMonthWeather";
import type { TimelineItem } from "../../../types";
import {
  preferActiveEvents,
  sortActiveThenDismissed,
} from "../timelineDismissUtils";
import type { TimelineEventStatusMap } from "../../../domain/timeline/status";
import { useScheduleEmojisMap } from "../../schedule/useScheduleEmojis";
import type { ScheduleEmojiMap } from "../../schedule/scheduleEmojisStore";
import {
  calendarDayEventsGridClass,
  calendarDayGridClass,
  calendarDayHeaderClass,
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
import {
  calendarScrollableClass,
  monthCalendarFillClass,
} from "./timelineCalendarClasses";
import { TimelineDayEventCard } from "./TimelineDayEventCard";
import { TimelineHolidayChip } from "./TimelineHolidayChip";
import { TimelineMonthGrid } from "./TimelineMonthGrid";
import { TimelineWeatherChip } from "./TimelineWeatherChip";
import { WeekEventChip } from "./TimelineWeekEventChip";

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
  /** Show month-cell ongoing icon+count chips (product default true). */
  showOngoing?: boolean;
  /** Show month-cell ending icon+count chips (product default true). */
  showEnding?: boolean;
  /** Month daily weather keyed by local YYYY-MM-DD (from page-level useMonthWeather). */
  weatherByDate?: Record<string, DailyWeather>;
  /** Country holidays for the weather location (from page-level useMonthHolidays). */
  holidaysByDate?: Record<string, DailyHoliday[]>;
  onSelectEvent: (event: TimelineItem) => void;
  onFocusDay: (day: Date) => void;
  onCreateOnDay?: (day: Date) => void;
  /** Page toolbar 顯示日期: muted dates; event rows hide, header weather stays. */
  datesRevealed?: boolean;
  /** Test override; production hydrates `schedule_emojis` from ui-prefs. */
  scheduleEmojis?: ScheduleEmojiMap;
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
  holidaysByDate = {},
  onSelectEvent,
  onFocusDay,
  onCreateOnDay,
  datesRevealed = false,
  scheduleEmojis,
}: TimelineCalendarViewProps) {
  const { t } = useTranslation("timeline");
  const hydratedEmojis = useScheduleEmojisMap();
  const emojis = scheduleEmojis ?? hydratedEmojis;

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
            <TimelineHolidayChip
              day={rangeStart}
              holidaysByDate={holidaysByDate}
            />
          </div>
          <div className={calendarDayEventsGridClass}>
            {rangeEvents.length === 0 ? (
              <div className={dayViewEmptyClass}>
                {t("calendar.noEventsToday")}
              </div>
            ) : (
              sortActiveThenDismissed(rangeEvents).map((event) => (
                <TimelineDayEventCard
                  key={event.id}
                  event={event}
                  focusedDay={rangeStart}
                  status={eventStatuses[event.id] ?? "pending"}
                  onSelect={onSelectEvent}
                  emojis={emojis}
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
                  <TimelineHolidayChip
                    day={day}
                    holidaysByDate={holidaysByDate}
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
                          emojis={emojis}
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
        holidaysByDate={holidaysByDate}
        datesRevealed={datesRevealed}
        onSelectEvent={onSelectEvent}
        onFocusDay={onFocusDay}
        onCreateOnDay={onCreateOnDay}
        emojis={emojis}
      />
    </div>
  );
}

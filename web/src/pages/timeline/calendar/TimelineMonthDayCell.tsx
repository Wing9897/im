import { useTranslation } from "react-i18next";
import type { TimelineItem } from "../../../types";
import {
  classifyMonthDaySpan,
  countMonthDaySpanIndicators,
  eventShowsInMonthDayPreview,
} from "../../../domain/timeline/monthDaySpanIndicators";
import { isSameDay, isToday } from "../../../domain/timeline/dateUtils";
import { preferActiveEvents } from "../timelineDismissUtils";
import {
  monthDayCellClass,
  monthDayHeaderClass,
  monthDayNumberClass,
  monthDayWatermarkClass,
  monthDayWatermarkStackClass,
  monthDaySurfaceClass,
  monthDayMetaClass,
  monthTodayLabelClass,
  monthDayWeekdayFillerClass,
} from "./timelineCalendarClasses";
import { holidayNamesForDay, type DailyHoliday } from "../../../hooks/useMonthHolidays";
import type { DailyWeather } from "../../../hooks/useMonthWeather";
import { TimelineWeatherChip } from "./TimelineWeatherChip";
import {
  MONTH_EVENT_PREVIEW_LIMIT,
  MonthDayEventPreview,
  MonthDaySpanIndicators,
  MonthHolidayWatermark,
} from "./TimelineMonthDayMarkers";

export type TimelineMonthDayCellProps = {
  day: Date;
  timeCursor: Date;
  focusedDay: Date | null;
  monthCursor: Date;
  monthEvents: TimelineItem[];
  showDismissed: boolean;
  showOngoing: boolean;
  showEnding: boolean;
  weatherByDate: Record<string, DailyWeather>;
  holidaysByDate: Record<string, DailyHoliday[]>;
  weekdayLabels: string[];
  formatDayLabel: (day: Date) => string;
  onSelectEvent: (event: TimelineItem) => void;
  onFocusDay: (day: Date) => void;
  onCreateOnDay?: (day: Date) => void;
  onOpenContextMenu: (day: Date, clientX: number, clientY: number) => void;
  onClearContextMenu: () => void;
};

export function TimelineMonthDayCell({
  day,
  timeCursor,
  focusedDay,
  monthCursor,
  monthEvents,
  showDismissed,
  showOngoing,
  showEnding,
  weatherByDate,
  holidaysByDate,
  weekdayLabels,
  formatDayLabel,
  onSelectEvent,
  onFocusDay,
  onCreateOnDay,
  onOpenContextMenu,
  onClearContextMenu,
}: TimelineMonthDayCellProps) {
  const { t } = useTranslation("timeline");
  const isCurrentMonth = day.getMonth() === monthCursor.getMonth();
  // Preview rows vs +N chips are mutually exclusive for every source.
  const dayEvents = preferActiveEvents(
    monthEvents.filter((event) => eventShowsInMonthDayPreview(event, day)),
    { showDismissed },
  );
  const spanDayEvents = preferActiveEvents(
    monthEvents.filter((event) => classifyMonthDaySpan(event, day) !== null),
    { showDismissed },
  );
  const spanCounts = countMonthDaySpanIndicators(spanDayEvents, day);
  const visibleOngoing = showOngoing ? spanCounts.ongoing : 0;
  const visibleEnding = showEnding ? spanCounts.ending : 0;
  const onlyDismissed =
    dayEvents.length > 0 && dayEvents.every((event) => Boolean(event.dismissed));
  const selectionDay = focusedDay ?? timeCursor;
  const activeDay = isSameDay(day, selectionDay);
  const today = isToday(day);
  const previewEvents = dayEvents.slice(0, MONTH_EVENT_PREVIEW_LIMIT);
  const overflowCount = dayEvents.length - previewEvents.length;
  const hasSpanIndicators = visibleOngoing > 0 || visibleEnding > 0;
  const showTodayLabel = today && isCurrentMonth && previewEvents.length === 0;
  const holidayNames = isCurrentMonth ? holidayNamesForDay(day, holidaysByDate) : [];
  const hasHoliday = holidayNames.length > 0;
  const showWeekdayFiller = !showTodayLabel && !hasSpanIndicators;

  const focusDay = () => {
    onClearContextMenu();
    onFocusDay(day);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={
        dayEvents.length > 0
          ? t("calendar.dayCellAria", {
              date: formatDayLabel(day),
              count: dayEvents.length,
            })
          : t("calendar.dayCellAriaEmpty", { date: formatDayLabel(day) })
      }
      aria-pressed={activeDay}
      data-testid="timeline-month-day-cell"
      className={`im-card-hover ${monthDayCellClass({
        isCurrentMonth,
        activeDay,
        today,
      })}`}
      onClick={focusDay}
      onContextMenu={
        onCreateOnDay
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
              onOpenContextMenu(day, event.clientX, event.clientY);
            }
          : undefined
      }
      title={onCreateOnDay ? t("calendar.createOnDayHint") : undefined}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          focusDay();
        }
      }}
    >
      <div className={monthDayWatermarkStackClass(hasHoliday)}>
        <div
          className={monthDayWatermarkClass({
            isCurrentMonth,
            today,
            activeDay,
          })}
          aria-hidden="true"
          data-testid="timeline-month-day-watermark"
        >
          {day.getDate()}
        </div>
        {hasHoliday ? <MonthHolidayWatermark names={holidayNames} /> : null}
      </div>
      <div className={monthDaySurfaceClass} data-testid="timeline-month-day-surface">
        <div className={monthDayHeaderClass} data-testid="timeline-month-day-header">
          <div className="flex min-w-0 flex-1 items-center gap-[3px] overflow-hidden">
            <span
              className={monthDayNumberClass({
                isCurrentMonth,
                today,
                activeDay,
              })}
              data-testid="timeline-month-day-number"
            >
              {day.getDate()}
            </span>
            {showTodayLabel && (
              <span className={monthTodayLabelClass}>{t("calendar.today")}</span>
            )}
            {hasSpanIndicators && (
              <MonthDaySpanIndicators
                visibleOngoing={visibleOngoing}
                visibleEnding={visibleEnding}
              />
            )}
            {showWeekdayFiller && (
              <span
                className={monthDayWeekdayFillerClass}
                data-testid="timeline-month-day-weekday-filler"
                aria-hidden="true"
              >
                {weekdayLabels[day.getDay()] ?? ""}
              </span>
            )}
          </div>
          <div className={monthDayMetaClass}>
            <TimelineWeatherChip
              day={day}
              weatherByDate={weatherByDate}
              visible={isCurrentMonth}
              testId="timeline-month-day-weather"
            />
          </div>
        </div>

        <MonthDayEventPreview
          previewEvents={previewEvents}
          overflowCount={overflowCount}
          onlyDismissed={onlyDismissed}
          onSelectEvent={onSelectEvent}
        />
      </div>
    </div>
  );
}

import { useTranslation } from "react-i18next";
import type { TimelineItem } from "../../../types";
import {
  classifyMonthDaySpan,
  countMonthDaySpanIndicators,
} from "../../../domain/timeline/monthDaySpanIndicators";
import { eventStartsOnDay, isSameDay, isToday } from "../../../domain/timeline/dateUtils";
import { preferActiveEvents, dismissedSurfaceClass, dismissedTitleClass } from "../timelineDismissUtils";
import {
  isWeekendDay,
  monthDayCellClass,
  monthDayHeaderClass,
  monthDayNumberClass,
  monthDayMetaClass,
  monthDaysGridClass,
  monthEventDotClass,
  monthEventPreviewRowClass,
  monthEventPreviewTextClass,
  monthEventsPreviewClass,
  monthGridContainerClass,
  monthSpanEndingDotClass,
  monthSpanEndingTextClass,
  monthSpanIndicatorRowClass,
  monthSpanIndicatorsClass,
  monthSpanOngoingDotClass,
  monthSpanOngoingTextClass,
  monthTodayLabelClass,
  monthWeekdayHeaderClass,
  monthWeekdayLabelClass,
  truncateMonthEventTitle,
} from "./timelineCalendarLayout";
import { weatherIcon, type DailyWeather } from "../../../hooks/useMonthWeather";

const MONTH_EVENT_PREVIEW_LIMIT = 2;

type TimelineMonthGridProps = {
  timeCursor: Date;
  focusedDay: Date | null;
  monthCursor: Date;
  monthDays: Date[];
  monthEvents: TimelineItem[];
  showDismissed?: boolean;
  showOngoing?: boolean;
  showEnding?: boolean;
  weatherByDate?: Record<string, DailyWeather>;
  onSelectEvent: (event: TimelineItem) => void;
  onFocusDay: (day: Date) => void;
};

export function TimelineMonthGrid({
  timeCursor,
  focusedDay,
  monthCursor,
  monthDays,
  monthEvents,
  weatherByDate = {},
  showDismissed = true,
  showOngoing = true,
  showEnding = true,
  onSelectEvent,
  onFocusDay,
}: TimelineMonthGridProps) {
  const { t, i18n } = useTranslation("timeline");
  const weekdayLabels = t("calendar.weekdays", { returnObjects: true }) as string[];
  const formatDayLabel = (day: Date) =>
    day.toLocaleDateString(i18n.language, {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });

  return (
    <div className={monthGridContainerClass} data-testid="timeline-month-grid">
      <div className={monthWeekdayHeaderClass}>
        {weekdayLabels.map((label, index) => (
          <div key={`${label}-${index}`} className={monthWeekdayLabelClass(index === 0 || index === 6)}>
            {label}
          </div>
        ))}
      </div>
      <div className={monthDaysGridClass}>
        {monthDays.map((day) => {
          const isCurrentMonth = day.getMonth() === monthCursor.getMonth();
          const dayEvents = preferActiveEvents(
            monthEvents.filter((event) => eventStartsOnDay(event, day)),
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
          const isWeekend = isWeekendDay(day);
          const previewEvents = dayEvents.slice(0, MONTH_EVENT_PREVIEW_LIMIT);
          const overflowCount = dayEvents.length - previewEvents.length;
          const hasSpanIndicators = visibleOngoing > 0 || visibleEnding > 0;
          const dateKey = [
            day.getFullYear(),
            String(day.getMonth() + 1).padStart(2, "0"),
            String(day.getDate()).padStart(2, "0"),
          ].join("-");
          const weather = weatherByDate[dateKey];

          return (
            <div
              key={day.toISOString()}
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
              className={`im-card-hover ${monthDayCellClass({
                isCurrentMonth,
                activeDay,
                today,
                isWeekend,
              })}`}
              onClick={() => onFocusDay(day)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onFocusDay(day);
                }
              }}
            >
              <div className={monthDayHeaderClass}>
                <div className={monthDayNumberClass({ isCurrentMonth, today, activeDay })}>
                  {day.getDate()}
                </div>
                <div className={monthDayMetaClass}>
                  {/* Circle already marks today; omit "今天" when previews need the row. */}
                  {today && isCurrentMonth && previewEvents.length === 0 && (
                    <span className={monthTodayLabelClass}>{t("calendar.today")}</span>
                  )}
                  {weather && isCurrentMonth && (
                    <span
                      className="inline-flex shrink-0 items-center gap-0.5 text-[10px] leading-none text-text-secondary"
                      aria-label={t("calendar.weatherAria", {
                        high: weather.high,
                        low: weather.low,
                      })}
                      title={t("calendar.weatherTitle", {
                        high: weather.high,
                        low: weather.low,
                      })}
                    >
                      <span aria-hidden="true">{weatherIcon(weather.code)}</span>
                      <span>{weather.high}°</span>
                    </span>
                  )}
                </div>
              </div>

              {(previewEvents.length > 0 || overflowCount > 0) && (
                <div className={monthEventsPreviewClass}>
                  {previewEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      className={`${monthEventPreviewRowClass} w-full border-none bg-transparent p-0 text-left ${
                        onlyDismissed || event.dismissed ? dismissedSurfaceClass : ""
                      }`}
                      onClick={(clickEvent) => {
                        clickEvent.stopPropagation();
                        onSelectEvent(event);
                      }}
                    >
                      <span className={monthEventDotClass} aria-hidden="true" />
                      <span
                        className={`${monthEventPreviewTextClass} ${
                          onlyDismissed || event.dismissed ? dismissedTitleClass : ""
                        }`}
                        title={event.title}
                      >
                        {truncateMonthEventTitle(event.title)}
                      </span>
                    </button>
                  ))}
                  {overflowCount > 0 && (
                    <div className={monthEventPreviewRowClass}>
                      <span className={monthEventPreviewTextClass}>
                        {t("calendar.more", { count: overflowCount })}
                      </span>
                    </div>
                  )}
                </div>
              )}
              {hasSpanIndicators && (
                <div className={monthSpanIndicatorsClass} data-testid="month-span-indicators">
                  {visibleOngoing > 0 && (
                    <div className={monthSpanIndicatorRowClass}>
                      <span className={monthSpanOngoingDotClass} aria-hidden="true" />
                      <span className={monthSpanOngoingTextClass}>
                        {t("calendar.ongoing", { count: visibleOngoing })}
                      </span>
                    </div>
                  )}
                  {visibleEnding > 0 && (
                    <div className={monthSpanIndicatorRowClass}>
                      <span className={monthSpanEndingDotClass} aria-hidden="true" />
                      <span className={monthSpanEndingTextClass}>
                        {t("calendar.ending", { count: visibleEnding })}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

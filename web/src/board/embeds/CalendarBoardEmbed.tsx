import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { CalendarOccurrence, TimelineItem } from "../../types";
import { calendarOccurrenceToBoardEvent } from "../../domain/timeline/timedEventMerge";
import {
  buildCalendarDays,
  eventStartsOnDay,
  formatTimeLabel,
  isToday,
  startOfDay,
  startOfMonth,
} from "../../domain/timeline/dateUtils";

interface CalendarBoardEmbedProps {
  occurrences: CalendarOccurrence[];
  mode: "day" | "month";
  onSelectOccurrence?: (occurrence: CalendarOccurrence) => void;
}

/**
 * Compact month calendar or today's event list for the ops board.
 */
export function CalendarBoardEmbed({
  occurrences,
  mode,
  onSelectOccurrence,
}: CalendarBoardEmbedProps) {
  const { t } = useTranslation();
  const weekdayLabels = t("board.calendar.weekdays", { returnObjects: true }) as string[];
  const now = useMemo(() => new Date(), []);
  // eventStartsOnDay expects a midnight day boundary; passing `now` would
  // exclude earlier-today events once the clock moves past their startTime.
  const todayStart = useMemo(() => startOfDay(now), [now]);
  const monthCursor = useMemo(() => startOfMonth(now), [now]);
  const monthDays = useMemo(() => buildCalendarDays(monthCursor), [monthCursor]);

  const events = useMemo(
    () => occurrences.map(calendarOccurrenceToBoardEvent) as TimelineItem[],
    [occurrences],
  );
  const todayEvents = useMemo(
    () => events.filter((event) => eventStartsOnDay(event, todayStart)),
    [events, todayStart],
  );

  const occurrenceById = useMemo(() => {
    const map = new Map<string, CalendarOccurrence>();
    for (const row of occurrences) {
      map.set(row.id, row);
    }
    return map;
  }, [occurrences]);

  const handleDayClick = (_day: Date, dayEvents: TimelineItem[]) => {
    if (dayEvents.length > 0) {
      const first = occurrenceById.get(dayEvents[0].id);
      if (first && onSelectOccurrence) {
        onSelectOccurrence(first);
        return;
      }
    }
  };

  return (
    <div className="board-calendar-embed" data-testid="board-calendar-embed">
      {mode === "month" ? (
        <div className="board-calendar-month" data-testid="board-calendar-month">
          <div className="board-calendar-month__weekdays">
            {weekdayLabels.map((label) => (
              <div key={label} className="board-calendar-month__weekday">
                {label}
              </div>
            ))}
          </div>
          <div className="board-calendar-month__days">
            {monthDays.map((day) => {
              const inMonth = day.getMonth() === monthCursor.getMonth();
              const dayEvents = events.filter((event) => eventStartsOnDay(event, day));
              const today = isToday(day);
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  className={[
                    "board-calendar-month__day",
                    inMonth ? "" : "board-calendar-month__day--muted",
                    today ? "board-calendar-month__day--today" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => handleDayClick(day, dayEvents)}
                >
                  <span className="board-calendar-month__num">{day.getDate()}</span>
                  {dayEvents.length > 0 ? (
                    <span
                      className="board-calendar-month__dots"
                      aria-label={t("board.calendar.dayCountAria", { count: dayEvents.length })}
                    >
                      {dayEvents.slice(0, 3).map((event) => (
                        <span key={event.id} className="board-calendar-month__dot" />
                      ))}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="board-calendar-day" data-testid="board-calendar-day">
          <div className="board-calendar-day__label">
            {weekdayLabels[now.getDay()]} {now.getDate()} · {t("board.calendar.today")}
          </div>
          {todayEvents.length === 0 ? (
            <span className="board-calendar-day__empty">{t("board.calendar.noSchedule")}</span>
          ) : (
            <div className="board-calendar-day__list" data-testid="board-calendar-day-list">
              {todayEvents.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  className="board-calendar-day__event"
                  onClick={() => handleDayClick(now, [event])}
                >
                  {!event.isAllDay ? (
                    <span className="board-calendar-day__time">
                      {formatTimeLabel(new Date(event.startTime))}
                    </span>
                  ) : null}
                  <span className="board-calendar-day__title">{event.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CalendarBoardEmbed;

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { AnalysisEvent } from "../../types";
import { asTimedAnalysisEvent } from "../../types/timelineItem";
import { EventListRow } from "../../components/timeline/EventListRow";
import {
  buildCalendarDays,
  dateKey,
  eventStartsOnDay,
  isToday,
  startOfDay,
  startOfMonth,
} from "../../domain/timeline/dateUtils";
import {
  resolveEventCardDisplay,
  type EventListCardMetaLookups,
} from "../../domain/timeline/eventListCardMeta";
import { holidayNamesForDay, useMonthHolidays } from "../../hooks/useMonthHolidays";
import { EventListTitleMark } from "../../components/timeline/EventListTitleMark";

interface CalendarBoardEmbedProps {
  /** Timed board events (analysis / user / recurring / item_remind). */
  events: AnalysisEvent[];
  mode: "day" | "month";
  onSelectEvent?: (event: AnalysisEvent) => void;
  metaLookups?: EventListCardMetaLookups;
}

/**
 * Compact month calendar or today's event list for the ops board.
 * Consumes AnalysisEvent rows directly from the calendar window projection
 * (avoids seriesId←taskId and analysis/user→recurring remaps).
 */
export function CalendarBoardEmbed({
  events: rawEvents,
  mode,
  onSelectEvent,
  metaLookups = {},
}: CalendarBoardEmbedProps) {
  const { t } = useTranslation();
  const weekdayLabels = t("board:calendar.weekdays", { returnObjects: true }) as string[];
  const now = useMemo(() => new Date(), []);
  const todayStart = useMemo(() => startOfDay(now), [now]);
  const monthCursor = useMemo(() => startOfMonth(now), [now]);
  const monthDays = useMemo(() => buildCalendarDays(monthCursor), [monthCursor]);
  const { holidaysByDate } = useMonthHolidays(mode === "month", monthDays);
  const eventAvatarAria = t("timeline:eventList.eventAvatarAria");

  const events = useMemo(
    () =>
      rawEvents
        .map((event) => asTimedAnalysisEvent(event))
        .filter((event): event is NonNullable<typeof event> => event !== null),
    [rawEvents],
  );
  const todayEvents = useMemo(
    () => events.filter((event) => eventStartsOnDay(event, todayStart)),
    [events, todayStart],
  );

  const eventById = useMemo(() => {
    const map = new Map<string, AnalysisEvent>();
    for (const row of rawEvents) {
      map.set(row.id, row);
    }
    return map;
  }, [rawEvents]);

  const handleDayClick = (_day: Date, dayEvents: typeof events) => {
    if (dayEvents.length > 0) {
      const first = eventById.get(dayEvents[0].id);
      if (first && onSelectEvent) {
        onSelectEvent(first);
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
              const holidayNames = inMonth ? holidayNamesForDay(day, holidaysByDate) : [];
              const hasHoliday = holidayNames.length > 0;
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  data-date={dateKey(day)}
                  className={[
                    "board-calendar-month__day",
                    inMonth ? "" : "board-calendar-month__day--muted",
                    today ? "board-calendar-month__day--today" : "",
                    hasHoliday ? "board-calendar-month__day--holiday" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  onClick={() => handleDayClick(day, dayEvents)}
                >
                  <span className="board-calendar-month__num">{day.getDate()}</span>
                  {hasHoliday ? <BoardMonthHolidayWatermark names={holidayNames} /> : null}
                  {dayEvents.length > 0 ? (
                    <span
                      className="board-calendar-month__chips"
                      aria-label={t("board:calendar.dayCountAria", { count: dayEvents.length })}
                    >
                      {dayEvents.slice(0, 3).map((event) => {
                        const leading = resolveEventCardDisplay(event, day).leading;
                        return (
                          <span
                            key={event.id}
                            className="board-calendar-month__chip"
                            title={event.title}
                            data-testid={`board-calendar-month-chip-${event.id}`}
                          >
                            <EventListTitleMark
                              event={event}
                              leading={leading}
                              metaLookups={metaLookups}
                              eventAvatarAria={eventAvatarAria}
                              markerClassName="board-calendar-month__chip-mark"
                            />
                          </span>
                        );
                      })}
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
            {weekdayLabels[now.getDay()]} {now.getDate()} · {t("board:calendar.today")}
          </div>
          {todayEvents.length === 0 ? (
            <span className="board-calendar-day__empty">{t("board:calendar.noSchedule")}</span>
          ) : (
            <div className="board-calendar-day__list" data-testid="board-calendar-day-list">
              {todayEvents.map((event) => (
                <EventListRow
                  key={event.id}
                  event={event}
                  metaLookups={metaLookups}
                  focusedDay={todayStart}
                  testId={`board-calendar-day-row-${event.id}`}
                  onSelect={() => {
                    const raw = eventById.get(event.id);
                    if (raw && onSelectEvent) onSelectEvent(raw);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Compact Nager name under the date number — not Timeline's large month-grid watermark. */
function BoardMonthHolidayWatermark({ names }: { names: string[] }) {
  const { t } = useTranslation("timeline");
  if (names.length === 0) return null;
  const extra = names.length - 1;
  const joined = names.join(t("calendar.holidayNameSep"));
  return (
    <span
      className="board-calendar-month__holiday"
      data-testid="board-calendar-month-holiday"
      aria-label={t("calendar.holidayAria", { name: joined })}
      title={t("calendar.holidayTitle", { name: joined })}
    >
      <span className="board-calendar-month__holiday-label">{names[0]}</span>
      {extra > 0 ? (
        <span className="board-calendar-month__holiday-extra">
          {t("calendar.holidayOverflow", { count: extra })}
        </span>
      ) : null}
    </span>
  );
}

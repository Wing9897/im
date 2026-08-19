import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarPlus, CirclePlay, Flag, type LucideIcon } from "lucide-react";
import type { TimelineItem } from "../../../types";
import { itemDateKindMarkerClass } from "../../../domain/items/itemCalendarProjection";
import { lookupScheduleEmoji } from "../../../domain/schedule/scheduleEmoji";
import {
  monthPreviewTitle,
  resolveCalendarLeadingGlyph,
} from "../../../domain/timeline/importantEventDisplay";
import {
  classifyMonthDaySpan,
  countMonthDaySpanIndicators,
  eventShowsInMonthDayPreview,
} from "../../../domain/timeline/monthDaySpanIndicators";
import { isSameDay, isToday } from "../../../domain/timeline/dateUtils";
import { preferActiveEvents, dismissedSurfaceClass, dismissedTitleClass } from "../timelineDismissUtils";
import {
  monthDayCellClass,
  monthDayHeaderClass,
  monthDayWatermarkClass,
  monthDayWatermarkStackClass,
  monthDayHolidayWatermarkClass,
  monthDaySurfaceClass,
  monthDayMetaClass,
  monthDaysGridClass,
  monthEventDotClass,
  monthEventPreviewRowClass,
  monthEventPreviewTextClass,
  monthEventsPreviewClass,
  monthGridRootClass,
  monthSpanEndingIconClass,
  monthSpanEndingTextClass,
  monthSpanIndicatorRowClass,
  monthSpanIndicatorsClass,
  monthSpanOngoingIconClass,
  monthSpanOngoingTextClass,
  monthTodayLabelClass,
  monthDayWeekdayFillerClass,
  monthWeekdayHeaderClass,
  monthWeekdayLabelClass,
  truncateMonthEventTitle,
} from "./timelineCalendarClasses";
import { holidayNamesForDay, type DailyHoliday } from "../../../hooks/useMonthHolidays";
import type { DailyWeather } from "../../../hooks/useMonthWeather";
import { TimelineWeatherChip } from "./TimelineWeatherChip";
import { ScheduleEventCompactEmoji } from "../components/ScheduleEventEmojiMark";
import type { ScheduleEmojiMap } from "../../schedule/scheduleEmojisStore";

const MONTH_EVENT_PREVIEW_LIMIT = 4;
const MONTH_SPAN_ICON_PROPS = { size: 10, strokeWidth: 2.5 } as const;

type DayContextMenuState = {
  day: Date;
  x: number;
  y: number;
};

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
  holidaysByDate?: Record<string, DailyHoliday[]>;
  onSelectEvent: (event: TimelineItem) => void;
  onFocusDay: (day: Date) => void;
  /** Month cell context menu → create event prefilled on that day. */
  onCreateOnDay?: (day: Date) => void;
  /** Toolbar 篩選 hover / 顯示日期: muted dates, hide event rows (header weather stays). */
  datesRevealed?: boolean;
  emojis: ScheduleEmojiMap;
};

export function TimelineMonthGrid({
  timeCursor,
  focusedDay,
  monthCursor,
  monthDays,
  monthEvents,
  weatherByDate = {},
  holidaysByDate = {},
  showDismissed = true,
  showOngoing = true,
  showEnding = true,
  onSelectEvent,
  onFocusDay,
  onCreateOnDay,
  datesRevealed = false,
  emojis,
}: TimelineMonthGridProps) {
  const { t, i18n } = useTranslation("timeline");
  const [contextMenu, setContextMenu] = useState<DayContextMenuState | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const weekdayLabels = t("calendar.weekdays", { returnObjects: true }) as string[];
  const formatDayLabel = (day: Date) =>
    day.toLocaleDateString(i18n.language, {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onPointerDown = (event: MouseEvent | PointerEvent) => {
      const target = event.target as Node | null;
      if (menuRef.current && target && menuRef.current.contains(target)) return;
      close();
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  const openDayContextMenu = (day: Date, clientX: number, clientY: number) => {
    onFocusDay(day);
    if (!onCreateOnDay) return;
    const pad = 8;
    const menuWidth = 180;
    const menuHeight = 44;
    const x = Math.min(clientX, window.innerWidth - menuWidth - pad);
    const y = Math.min(clientY, window.innerHeight - menuHeight - pad);
    setContextMenu({ day, x: Math.max(pad, x), y: Math.max(pad, y) });
  };
  return (
    <div
      className={monthGridRootClass(datesRevealed)}
      data-testid="timeline-month-grid"
      data-dates-revealed={datesRevealed ? "true" : "false"}
    >
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
          const holidayNames = isCurrentMonth
            ? holidayNamesForDay(day, holidaysByDate)
            : [];
          const hasHoliday = holidayNames.length > 0;
          const showWeekdayFiller = !showTodayLabel && !hasSpanIndicators;

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
              data-testid="timeline-month-day-cell"
              className={`im-card-hover ${monthDayCellClass({
                isCurrentMonth,
                activeDay,
                today,
              })}`}
              onClick={() => {
                setContextMenu(null);
                onFocusDay(day);
              }}
              onContextMenu={
                onCreateOnDay
                  ? (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      openDayContextMenu(day, event.clientX, event.clientY);
                    }
                  : undefined
              }
              title={
                onCreateOnDay ? t("calendar.createOnDayHint") : undefined
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setContextMenu(null);
                  onFocusDay(day);
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
              <div
                className={monthDaySurfaceClass}
                data-testid="timeline-month-day-surface"
              >
                <div
                  className={monthDayHeaderClass}
                  data-testid="timeline-month-day-header"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-[3px] overflow-hidden">
                    {showTodayLabel && (
                      <span className={monthTodayLabelClass}>{t("calendar.today")}</span>
                    )}
                    {hasSpanIndicators && (
                      <div className={monthSpanIndicatorsClass} data-testid="month-span-indicators">
                        {visibleOngoing > 0 && (
                          <MonthSpanCountChip
                            display={t("calendar.ongoing", { count: visibleOngoing })}
                            icon={CirclePlay}
                            iconClass={monthSpanOngoingIconClass}
                            textClass={monthSpanOngoingTextClass}
                            label={t("calendar.ongoingAria", { count: visibleOngoing })}
                            testId="month-span-ongoing"
                          />
                        )}
                        {visibleEnding > 0 && (
                          <MonthSpanCountChip
                            display={t("calendar.ending", { count: visibleEnding })}
                            icon={Flag}
                            iconClass={monthSpanEndingIconClass}
                            textClass={monthSpanEndingTextClass}
                            label={t("calendar.endingAria", { count: visibleEnding })}
                            testId="month-span-ending"
                          />
                        )}
                      </div>
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

                {(previewEvents.length > 0 || overflowCount > 0) && (
                  <div className={monthEventsPreviewClass}>
                    {previewEvents.map((event) => {
                      const leading = resolveCalendarLeadingGlyph(event);
                      const rowTitle = monthPreviewTitle(event);
                      return (
                      <button
                        key={event.id}
                        type="button"
                        className={`${monthEventPreviewRowClass} w-full border-none p-0 text-left ${
                          onlyDismissed || event.dismissed ? dismissedSurfaceClass : ""
                        }`}
                        onClick={(clickEvent) => {
                          clickEvent.stopPropagation();
                          onSelectEvent(event);
                        }}
                      >
                        {leading ? (
                          <span
                            className={
                              leading.type === "item"
                                ? itemDateKindMarkerClass(leading.itemDateKind)
                                : itemDateKindMarkerClass(null)
                            }
                            aria-hidden="true"
                            data-testid={
                              leading.type === "important"
                                ? "month-important-marker"
                                : `month-item-marker-${leading.itemDateKind ?? "item"}`
                            }
                          >
                            {leading.emoji}
                          </span>
                        ) : lookupScheduleEmoji(emojis, event) ? (
                          <ScheduleEventCompactEmoji event={event} emojis={emojis} />
                        ) : (
                          <span
                            className={monthEventDotClass}
                            aria-hidden="true"
                          />
                        )}
                        <span
                          className={`${monthEventPreviewTextClass} ${
                            onlyDismissed || event.dismissed ? dismissedTitleClass : ""
                          }`}
                          title={rowTitle}
                        >
                          {truncateMonthEventTitle(rowTitle)}
                        </span>
                      </button>
                      );
                    })}
                    {overflowCount > 0 && (
                      <div className={monthEventPreviewRowClass} data-testid="month-event-overflow">
                        <span className={monthEventPreviewTextClass}>
                          {t("calendar.more", { count: overflowCount })}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {contextMenu && onCreateOnDay ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label={t("calendar.dayContextMenuAria")}
          data-testid="timeline-month-day-context-menu"
          className="im-menu-surface fixed z-[200] min-w-[11rem] rounded-md py-1"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 border-none bg-transparent px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-overlay"
            data-testid="timeline-month-day-context-add-event"
            onClick={() => {
              const day = contextMenu.day;
              setContextMenu(null);
              onCreateOnDay(day);
            }}
          >
            <CalendarPlus size={16} strokeWidth={2.25} aria-hidden="true" />
            <span>{t("calendar.addEventOnDay")}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MonthSpanCountChip({
  display,
  icon: Icon,
  iconClass,
  textClass,
  label,
  testId,
}: {
  display: string;
  icon: LucideIcon;
  iconClass: string;
  textClass: string;
  label: string;
  testId: string;
}) {
  return (
    <div
      className={monthSpanIndicatorRowClass}
      data-testid={testId}
      aria-label={label}
      title={label}
    >
      <Icon
        size={MONTH_SPAN_ICON_PROPS.size}
        strokeWidth={MONTH_SPAN_ICON_PROPS.strokeWidth}
        className={iconClass}
        aria-hidden="true"
      />
      <span className={textClass}>{display}</span>
    </div>
  );
}

function MonthHolidayWatermark({ names }: { names: string[] }) {
  const { t } = useTranslation("timeline");
  if (names.length === 0) return null;
  const extra = names.length - 1;
  const joined = names.join(t("calendar.holidayNameSep"));
  return (
    <div
      className={monthDayHolidayWatermarkClass}
      data-testid="timeline-month-day-holiday-name"
      aria-label={t("calendar.holidayAria", { name: joined })}
      title={t("calendar.holidayTitle", { name: joined })}
    >
      <span className="im-month-day-holiday-watermark-label">{names[0]}</span>
      {extra > 0 ? (
        <span className="im-month-day-holiday-watermark-extra">
          {t("calendar.holidayOverflow", { count: extra })}
        </span>
      ) : null}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarPlus } from "lucide-react";
import type { TimelineItem } from "../../../types";
import { itemDateKindMarkerClass } from "../../../domain/items/itemCalendarProjection";
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
import type { DailyWeather } from "../../../hooks/useMonthWeather";
import { TimelineWeatherChip } from "./TimelineWeatherChip";

const MONTH_EVENT_PREVIEW_LIMIT = 2;

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
  onSelectEvent: (event: TimelineItem) => void;
  onFocusDay: (day: Date) => void;
  /** Month cell context menu → create event prefilled on that day. */
  onCreateOnDay?: (day: Date) => void;
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
  onCreateOnDay,
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
          const isWeekend = isWeekendDay(day);
          const previewEvents = dayEvents.slice(0, MONTH_EVENT_PREVIEW_LIMIT);
          const overflowCount = dayEvents.length - previewEvents.length;
          const hasSpanIndicators = visibleOngoing > 0 || visibleEnding > 0;

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
              <div className={monthDayHeaderClass}>
                <div className={monthDayNumberClass({ isCurrentMonth, today, activeDay })}>
                  {day.getDate()}
                </div>
                <div className={monthDayMetaClass}>
                  {/* Circle already marks today; omit "今天" when previews need the row. */}
                  {today && isCurrentMonth && previewEvents.length === 0 && (
                    <span className={monthTodayLabelClass}>{t("calendar.today")}</span>
                  )}
                  <TimelineWeatherChip
                    day={day}
                    weatherByDate={weatherByDate}
                    visible={isCurrentMonth}
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
                      className={`${monthEventPreviewRowClass} w-full border-none bg-transparent p-0 text-left ${
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

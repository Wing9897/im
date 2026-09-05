import type { CSSProperties, Ref, RefObject } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type { TimelineItem } from "../../../types";
import {
  blockCardColorAttr,
  blockCardColorCss,
  type BlockCardColorChoice,
} from "../../../domain/timeline/blockCardColors";
import { eventShowsInMonthDayPreview } from "../../../domain/timeline/monthDaySpanIndicators";
import { isSameDay, isToday } from "../../../domain/timeline/dateUtils";
import { SPLIT_MONTH_DOT_LIMIT } from "../../../domain/timeline/monthCardSources";
import { resolveWorksetCoverSrc } from "../../../domain/worksets/worksetCover";
import { dateKey } from "../../../utils/dateFormat";
import { preferActiveEvents, dismissedTitleClass } from "../timelineDismissUtils";
import { dayCardTimeLabel } from "./dayCardTimeLabel";
import { placeSplitDayPopover } from "./splitDayPopoverPlacement";
import { SubscribedEventSubscribeIcon } from "../../../components/timeline/SubscribedEventSubscribeIcon";
import { TimelineSplitMonthColorControl } from "./TimelineSplitMonthColorControl";

export function eventsForSplitMonthDay(
  events: TimelineItem[],
  day: Date,
  showDismissed: boolean,
): TimelineItem[] {
  return preferActiveEvents(
    events.filter((event) => eventShowsInMonthDayPreview(event, day)),
    { showDismissed },
  );
}

type TimelineSplitMonthCardProps = {
  title: string;
  kind: "workset" | "subscribe";
  /** Catalog cover URL/data; empty uses the muted calendar placeholder. No upload. */
  cover?: string;
  events: TimelineItem[];
  monthCursor: Date;
  monthDays: Date[];
  showDismissed?: boolean;
  accentColor?: BlockCardColorChoice;
  onAccentColorChange?: (color: BlockCardColorChoice | null) => void;
  /** Last-clicked day on this card only; never a shared focusedDay/timeCursor. */
  selectedDay: Date | null;
  openDay: Date | null;
  popoverRef: RefObject<HTMLDivElement | null>;
  onToggleDay: (day: Date) => void;
  onSelectEvent: (event: TimelineItem) => void;
  onFocusDay: (day: Date) => void;
  onCreateOnDay?: (day: Date) => void;
  onClosePopover: () => void;
};

export function TimelineSplitMonthCard({
  title,
  kind,
  cover = "",
  events,
  monthCursor,
  monthDays,
  showDismissed = true,
  accentColor,
  onAccentColorChange,
  selectedDay,
  openDay,
  popoverRef,
  onToggleDay,
  onSelectEvent,
  onFocusDay,
  onCreateOnDay,
  onClosePopover,
}: TimelineSplitMonthCardProps) {
  const { t, i18n } = useTranslation("timeline");
  const weekdayLabels = t("calendar.weekdays", { returnObjects: true }) as string[];
  const formatDayLabel = (day: Date) =>
    day.toLocaleDateString(i18n.language, {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  const popoverOpen = openDay != null;
  const openDayCellRef = useRef<HTMLDivElement | null>(null);
  const accentCss = blockCardColorCss(accentColor);
  const cardStyle = accentCss
    ? ({
        "--split-month-card-accent": accentCss,
        "--split-month-card-dot": accentCss,
      } as CSSProperties)
    : undefined;

  return (
    <section
      className={`im-surface-panel im-split-month-card${popoverOpen ? " is-popover-open" : ""}`}
      data-testid="timeline-month-card"
      data-card-kind={kind}
      data-card-color={blockCardColorAttr(accentColor)}
      style={cardStyle}
      aria-label={t("calendar.monthCardAria", { title })}
    >
      <header className="im-split-month-header">
        <h3 className="im-split-month-title">{title}</h3>
        {kind === "subscribe" ? (
          <SubscribedEventSubscribeIcon
            className="im-split-month-subscribe-icon"
            ariaLabel={t("calendar.monthCardSubscribeAria")}
            title={t("calendar.monthCardSubscribed")}
            testId="timeline-month-card-subscribe-icon"
          />
        ) : null}
        {onAccentColorChange ? (
          <TimelineSplitMonthColorControl
            color={accentColor}
            onChange={onAccentColorChange}
          />
        ) : null}
      </header>
      <div className="im-split-month-cover" data-testid="timeline-month-card-cover" aria-hidden="true">
        <img src={resolveWorksetCoverSrc(cover)} alt="" draggable={false} />
      </div>
      <div className="im-split-month-weekdays" aria-hidden="true">
        {weekdayLabels.map((label, index) => (
          <div key={`${label}-${index}`} className="im-split-month-weekday">
            {label}
          </div>
        ))}
      </div>
      <div className="im-split-month-days" data-testid="timeline-split-month-grid">
        {monthDays.map((day) => {
          const dayEvents = eventsForSplitMonthDay(events, day, showDismissed);
          const isCurrentMonth = day.getMonth() === monthCursor.getMonth();
          const today = isToday(day);
          const isOpen = openDay != null && isSameDay(day, openDay);
          const activeDay = selectedDay != null && isSameDay(day, selectedDay);
          const dateLabel = formatDayLabel(day);
          const dayClass = [
            "im-split-month-day",
            isCurrentMonth ? "" : "is-outside",
            today && isCurrentMonth ? "is-today" : "",
            activeDay ? "is-active" : "",
            isOpen ? "is-open" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <div
              key={day.toISOString()}
              ref={isOpen ? openDayCellRef : undefined}
              role="button"
              tabIndex={0}
              aria-label={
                dayEvents.length > 0
                  ? t("calendar.dayCellAria", {
                      date: dateLabel,
                      count: dayEvents.length,
                    })
                  : t("calendar.dayCellAriaEmpty", { date: dateLabel })
              }
              aria-expanded={isOpen}
              aria-haspopup="dialog"
              aria-pressed={activeDay}
              data-testid="timeline-split-month-day"
              data-day={dateKey(day)}
              className={dayClass}
              onClick={() => {
                onFocusDay(day);
                onToggleDay(day);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onFocusDay(day);
                  onToggleDay(day);
                }
              }}
            >
              <span className="im-split-month-day-number" data-testid="timeline-split-month-day-number">
                {day.getDate()}
              </span>
              {dayEvents.length > 0 ? (
                <span className="im-split-month-dots" aria-hidden="true">
                  {dayEvents.slice(0, SPLIT_MONTH_DOT_LIMIT).map((_, index) => (
                    <span
                      key={index}
                      className="im-split-month-dot"
                      data-testid="timeline-split-month-dot"
                    />
                  ))}
                </span>
              ) : null}
              {isOpen ? (
                <SplitDayPopover
                  day={day}
                  dateLabel={dateLabel}
                  events={dayEvents}
                  popoverRef={popoverRef}
                  anchorRef={openDayCellRef}
                  onSelectEvent={onSelectEvent}
                  onCreateOnDay={onCreateOnDay}
                  onClose={onClosePopover}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SplitDayPopover({
  day,
  dateLabel,
  events,
  popoverRef,
  anchorRef,
  onSelectEvent,
  onCreateOnDay,
  onClose,
}: {
  day: Date;
  dateLabel: string;
  events: TimelineItem[];
  popoverRef: RefObject<HTMLDivElement | null>;
  anchorRef: RefObject<HTMLDivElement | null>;
  onSelectEvent: (event: TimelineItem) => void;
  onCreateOnDay?: (day: Date) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("timeline");
  const allDayLabel = t("userEvent.allDay");
  const [coords, setCoords] = useState<CSSProperties>({
    position: "fixed",
    top: -9999,
    left: -9999,
  });
  const [placement, setPlacement] = useState<"below" | "above">("below");

  useLayoutEffect(() => {
    const update = () => {
      const anchor = anchorRef.current;
      const popover = popoverRef.current;
      if (!anchor || !popover) return;
      const rect = anchor.getBoundingClientRect();
      const placed = placeSplitDayPopover({
        anchor: rect,
        popoverWidth: popover.offsetWidth,
        popoverHeight: popover.offsetHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      });
      setPlacement(placed.placement);
      setCoords({
        position: "fixed",
        top: placed.top,
        left: placed.left,
        maxHeight: placed.maxHeight > 0 ? placed.maxHeight : undefined,
      });
    };
    update();
    const raf = requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRef, popoverRef, events.length]);

  const node = (
    <div
      ref={popoverRef as Ref<HTMLDivElement>}
      role="dialog"
      aria-label={t("calendar.splitDayListAria", { date: dateLabel })}
      data-testid="timeline-split-month-popover"
      data-placement={placement}
      className="im-menu-surface im-split-month-popover"
      style={coords}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {events.length === 0 ? (
        <div className="im-split-month-popover-empty" data-testid="timeline-split-month-popover-empty">
          <p>{t("calendar.splitDayEmpty")}</p>
          {onCreateOnDay ? (
            <button
              type="button"
              className="im-split-month-popover-add"
              data-testid="timeline-split-month-popover-add"
              onClick={() => {
                onClose();
                onCreateOnDay(day);
              }}
            >
              {t("calendar.addEventOnDay")}
            </button>
          ) : null}
        </div>
      ) : (
        <ul className="im-split-month-popover-list">
          {events.map((event) => (
            <li key={event.id}>
              <button
                type="button"
                className="im-split-month-popover-row"
                data-testid="timeline-split-month-popover-row"
                onClick={() => {
                  onClose();
                  onSelectEvent(event);
                }}
              >
                <span className="im-split-month-popover-time">
                  {dayCardTimeLabel(event, allDayLabel)}
                </span>
                <span
                  className={`im-split-month-popover-title${event.dismissed ? ` ${dismissedTitleClass}` : ""}`}
                >
                  {event.title.trim() || t("gantt.untitled")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return createPortal(node, document.body);
}

import { useTranslation } from "react-i18next";
import { CalendarPlus } from "lucide-react";
import type { TimelineItem } from "../../../types";
import {
  monthDaysGridClass,
  monthGridRootClass,
  monthWeekdayHeaderClass,
  monthWeekdayLabelClass,
} from "../timelineCalendarClasses";
import type { DailyHoliday } from "../../../hooks/useMonthHolidays";
import type { DailyWeather } from "../../../hooks/useMonthWeather";
import { TimelineMonthDayCell } from "./TimelineMonthDayCell";
import { useMonthDayContextMenu } from "./useMonthDayContextMenu";

/** Shared chrome for the unified month grid and per-source month cards. */
export type TimelineMonthChromeProps = {
  timeCursor: Date;
  focusedDay: Date | null;
  monthCursor: Date;
  monthDays: Date[];
  showDismissed?: boolean;
  showOngoing?: boolean;
  showEnding?: boolean;
  onSelectEvent: (event: TimelineItem) => void;
  onFocusDay: (day: Date) => void;
  /** Month cell context menu → create event prefilled on that day. */
  onCreateOnDay?: (day: Date) => void;
  /** Toolbar 篩選 hover / 顯示日期: stronger bottom watermarks; hide event rows. Header (day number, 進行中/結束, weather) stays. */
  datesRevealed?: boolean;
};

type TimelineMonthGridProps = TimelineMonthChromeProps & {
  monthEvents: TimelineItem[];
  weatherByDate?: Record<string, DailyWeather>;
  holidaysByDate?: Record<string, DailyHoliday[]>;
  /** Mini month-card: no weather/holidays, fewer preview rows, no fill height. */
  compact?: boolean;
  previewLimit?: number;
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
  compact = false,
  previewLimit,
}: TimelineMonthGridProps) {
  const { t, i18n } = useTranslation("timeline");
  const { contextMenu, setContextMenu, menuRef, openDayContextMenu } =
    useMonthDayContextMenu();
  const weekdayLabels = t("calendar.weekdays", { returnObjects: true }) as string[];
  const formatDayLabel = (day: Date) =>
    day.toLocaleDateString(i18n.language, {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });

  const handleOpenContextMenu = (day: Date, clientX: number, clientY: number) => {
    onFocusDay(day);
    if (!onCreateOnDay) return;
    openDayContextMenu(day, clientX, clientY);
  };

  return (
    <div
      className={monthGridRootClass(datesRevealed, compact)}
      data-testid="timeline-month-grid"
      data-dates-revealed={datesRevealed ? "true" : "false"}
      data-compact={compact ? "true" : "false"}
    >
      <div className={monthWeekdayHeaderClass}>
        {weekdayLabels.map((label, index) => (
          <div key={`${label}-${index}`} className={monthWeekdayLabelClass(index === 0 || index === 6)}>
            {label}
          </div>
        ))}
      </div>
      <div className={monthDaysGridClass}>
        {monthDays.map((day) => (
          <TimelineMonthDayCell
            key={day.toISOString()}
            day={day}
            timeCursor={timeCursor}
            focusedDay={focusedDay}
            monthCursor={monthCursor}
            monthEvents={monthEvents}
            showDismissed={showDismissed}
            showOngoing={showOngoing}
            showEnding={showEnding}
            weatherByDate={weatherByDate}
            holidaysByDate={holidaysByDate}
            hideOverlays={compact}
            previewLimit={previewLimit}
            weekdayLabels={weekdayLabels}
            formatDayLabel={formatDayLabel}
            onSelectEvent={onSelectEvent}
            onFocusDay={onFocusDay}
            onCreateOnDay={onCreateOnDay}
            onOpenContextMenu={handleOpenContextMenu}
            onClearContextMenu={() => setContextMenu(null)}
          />
        ))}
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

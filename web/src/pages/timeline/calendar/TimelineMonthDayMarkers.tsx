import { useTranslation } from "react-i18next";
import { CircleCheck, Timer, type LucideIcon } from "lucide-react";
import { ScheduleEventCompactEmoji } from "../../../components/timeline/ScheduleEventTitleMark";
import type { TimelineItem } from "../../../types";
import { itemDateKindMarkerClass } from "../../../domain/items/itemCalendarProjection";
import { lookupScheduleEmoji } from "../../../domain/schedule/scheduleEmoji";
import {
  monthPreviewTitle,
  resolveCalendarLeadingGlyph,
} from "../../../domain/timeline/importantEventDisplay";
import { dismissedSurfaceClass, dismissedTitleClass } from "../timelineDismissUtils";
import {
  monthDayHolidayWatermarkClass,
  monthEventDotClass,
  monthEventPreviewRowClass,
  monthEventPreviewTextClass,
  monthEventsPreviewClass,
  monthSpanEndingIconClass,
  monthSpanEndingTextClass,
  monthSpanIndicatorRowClass,
  monthSpanIndicatorsClass,
  monthSpanOngoingIconClass,
  monthSpanOngoingTextClass,
  truncateMonthEventTitle,
} from "../timelineCalendarClasses";
const MONTH_SPAN_ICON_PROPS = { size: 10, strokeWidth: 2.5 } as const;

export const MONTH_EVENT_PREVIEW_LIMIT = 4;

export function MonthSpanCountChip({
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

export function MonthHolidayWatermark({ names }: { names: string[] }) {
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

export function MonthDaySpanIndicators({
  visibleOngoing,
  visibleEnding,
}: {
  visibleOngoing: number;
  visibleEnding: number;
}) {
  const { t } = useTranslation("timeline");
  if (visibleOngoing <= 0 && visibleEnding <= 0) return null;
  return (
    <div className={monthSpanIndicatorsClass} data-testid="month-span-indicators">
      {visibleOngoing > 0 && (
        <MonthSpanCountChip
          display={t("calendar.ongoing", { count: visibleOngoing })}
          icon={Timer}
          iconClass={monthSpanOngoingIconClass}
          textClass={monthSpanOngoingTextClass}
          label={t("calendar.ongoingAria", { count: visibleOngoing })}
          testId="month-span-ongoing"
        />
      )}
      {visibleEnding > 0 && (
        <MonthSpanCountChip
          display={t("calendar.ending", { count: visibleEnding })}
          icon={CircleCheck}
          iconClass={monthSpanEndingIconClass}
          textClass={monthSpanEndingTextClass}
          label={t("calendar.endingAria", { count: visibleEnding })}
          testId="month-span-ending"
        />
      )}
    </div>
  );
}

export function MonthDayEventPreview({
  previewEvents,
  overflowCount,
  onlyDismissed,
  onSelectEvent,
}: {
  previewEvents: TimelineItem[];
  overflowCount: number;
  onlyDismissed: boolean;
  onSelectEvent: (event: TimelineItem) => void;
}) {
  const { t } = useTranslation("timeline");
  if (previewEvents.length === 0 && overflowCount <= 0) return null;
  return (
    <div className={monthEventsPreviewClass}>
      {previewEvents.map((event) => {
        const leading = resolveCalendarLeadingGlyph(event);
        const scheduleEmoji = leading ? "" : lookupScheduleEmoji(event);
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
            ) : scheduleEmoji ? (
              <ScheduleEventCompactEmoji event={event} />
            ) : (
              <span className={monthEventDotClass} aria-hidden="true" />
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
  );
}

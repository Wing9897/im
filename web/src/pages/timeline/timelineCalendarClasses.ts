import { timelinePanelClass } from "./timelineViewLayout";
import i18n from "../../i18n";

/** Month panel: less padding, fills available height in the timeline column. */
export const calendarMonthPanelClass = `${timelinePanelClass} box-border flex h-full min-h-0 flex-col p-sm`;

export const monthCalendarFillClass = "flex h-full min-h-0 flex-1 flex-col";

export const calendarScrollableClass =
  "min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable]";

export const monthGridContainerClass =
  "im-timeline-month-grid flex h-full min-h-0 flex-1 flex-col gap-xs";

export function monthGridRootClass(datesRevealed: boolean, compact = false): string {
  const root = compact
    ? "im-timeline-month-grid im-timeline-month-grid--compact flex min-h-[12rem] flex-col gap-xs"
    : monthGridContainerClass;
  return datesRevealed ? `${root} is-revealed` : root;
}

export const monthWeekdayHeaderClass =
  "grid min-h-4 shrink-0 grid-cols-7 items-center gap-xs px-0.5";

export function monthWeekdayLabelClass(isWeekend: boolean): string {
  return [
    "text-center text-card-meta font-semibold leading-none tracking-wide",
    isWeekend ? "text-accent opacity-80" : "text-text-muted opacity-60",
  ].join(" ");
}

export const monthDaysGridClass =
  "grid min-h-0 flex-1 grid-cols-7 grid-rows-6 gap-[3px]";

export type MonthDayCellParams = {
  isCurrentMonth: boolean;
  activeDay: boolean;
  today: boolean;
};

export function monthDayCellClass({
  isCurrentMonth,
  activeDay,
  today,
}: MonthDayCellParams): string {
  const base =
    "im-month-day-cell box-border relative flex h-full min-h-0 cursor-pointer flex-col items-stretch justify-start overflow-hidden rounded-md border p-[3px_5px] shadow-[0_1px_2px_color-mix(in_srgb,var(--text-primary)_12%,transparent)] transition-[border-color,box-shadow,background] duration-150";

  if (activeDay) {
    return `${base} border-accent bg-[color-mix(in_srgb,var(--accent)_14%,var(--surface-panel))] ${isCurrentMonth ? "opacity-100" : "opacity-[0.72]"}`;
  }

  if (today) {
    return `${base} border-[color-mix(in_srgb,var(--accent)_40%,var(--surface-border))] im-surface-inset ${isCurrentMonth ? "opacity-100" : "opacity-[0.72]"}`;
  }

  if (isCurrentMonth) {
    return `${base} border-[color-mix(in_srgb,var(--surface-border)_88%,transparent)] im-surface-inset opacity-100`;
  }

  // Out-of-month: use panel directly (no extra 32% dilution over an already soft token).
  return `${base} border-[color-mix(in_srgb,var(--surface-border)_88%,transparent)] im-surface-panel opacity-[0.72]`;
}

/** Fixed-height chip band; CSS in timeline-page.css reserves height even when empty. */
export const monthDayHeaderClass = "im-month-day-header";

/** Compact 1–31 numeral pinned top-left of the header (watermark stays decorative). */
export function monthDayNumberClass({
  isCurrentMonth,
  today,
  activeDay,
}: Pick<MonthDayCellParams, "isCurrentMonth" | "today" | "activeDay">): string {
  const highlighted = (today || activeDay) && isCurrentMonth;
  if (!highlighted) {
    return [
      "im-month-day-number flex h-4 min-w-4 shrink-0 items-center justify-center text-card-meta tabular-nums leading-none",
      isCurrentMonth ? "font-medium text-text-primary" : "font-normal text-text-muted",
    ].join(" ");
  }

  return [
    "im-month-day-number flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full px-0.5 text-card-meta font-bold tabular-nums leading-none text-[color:var(--accent-contrast,white)]",
    activeDay ? "bg-accent" : "bg-[color-mix(in_srgb,var(--accent)_72%,transparent)]",
  ].join(" ");
}

/** Positioned stack: large date number + optional holiday name underneath. */
export function monthDayWatermarkStackClass(isHoliday = false): string {
  return ["im-month-day-watermark-stack", isHoliday ? "is-holiday" : ""]
    .filter(Boolean)
    .join(" ");
}

/** Holiday name under the date number — muted watermark, not a header chip. */
export const monthDayHolidayWatermarkClass = "im-month-day-holiday-watermark";

export function monthDayWatermarkClass({
  isCurrentMonth,
  today,
  activeDay,
}: Pick<MonthDayCellParams, "isCurrentMonth" | "today" | "activeDay">): string {
  return [
    "im-month-day-watermark",
    isCurrentMonth ? "" : "is-outside",
    today && isCurrentMonth ? "is-today" : "",
    activeDay && isCurrentMonth ? "is-active" : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Event overlay above the watermark date + holiday name. Reveal hides event titles/+N, not the header. */
export const monthDaySurfaceClass =
  "im-month-day-surface relative z-[1] flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden";

export const monthDayMetaClass = "flex min-w-0 items-center justify-end gap-[3px]";

export const monthTodayLabelClass = "text-card-meta font-semibold leading-none text-accent";

/** Muted weekday cap when the reserved header has no 今天 / 到期 chip. */
export const monthDayWeekdayFillerClass = "im-month-day-weekday-filler";

export const monthEventsPreviewClass =
  "im-month-day-events flex min-h-0 flex-1 flex-col gap-px overflow-hidden";

const monthSurfaceChipClass =
  "rounded-sm bg-[color-mix(in_srgb,var(--surface-panel)_78%,transparent)] px-0.5";

export const monthEventPreviewRowClass =
  `flex min-w-0 shrink-0 items-center gap-1 ${monthSurfaceChipClass}`;

/** 一般事件 — uses --calendar-dot-event (default: accent). */
export const monthEventDotClass =
  "h-1 w-1 shrink-0 rounded-full bg-[var(--calendar-dot-event)] opacity-80";

export const monthEventPreviewTextClass =
  "min-w-0 truncate text-card-meta leading-none text-text-secondary";

/** Compact span counters in the reserved header band (今天 / weather). */
export const monthSpanIndicatorsClass =
  "im-month-span-indicators flex min-w-0 shrink-0 items-center gap-0.5 overflow-hidden";

export const monthSpanIndicatorRowClass =
  `flex min-w-0 shrink-0 items-center gap-px ${monthSurfaceChipClass}`;

/** 進行中 lucide Timer — --calendar-dot-ongoing (info; same token as 已確認 legend). */
export const monthSpanOngoingIconClass =
  "shrink-0 text-[var(--calendar-dot-ongoing)] opacity-95";

/** 結束 lucide CircleCheck — --calendar-dot-ending (warning; same token as 待確認 legend). */
export const monthSpanEndingIconClass =
  "shrink-0 text-[var(--calendar-dot-ending)] opacity-95";

/** Span count is numeric only; icon color carries 進行中 / 結束. */
export const monthSpanOngoingTextClass = `${monthEventPreviewTextClass} tabular-nums`;

export const monthSpanEndingTextClass = `${monthEventPreviewTextClass} tabular-nums`;

export function truncateMonthEventTitle(title: string, maxLength = 9): string {
  const trimmed = title.trim() || String(i18n.t("timeline:gantt.untitled"));
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}…`;
}

export function isWeekendDay(day: Date): boolean {
  const weekday = day.getDay();
  return weekday === 0 || weekday === 6;
}

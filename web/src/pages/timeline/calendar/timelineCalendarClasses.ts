import { timelinePanelClass } from "../timelineViewLayout";
import i18n from "../../../i18n";

/** Month panel: less padding, fills available height in the timeline column. */
export const calendarMonthPanelClass = `${timelinePanelClass} box-border flex h-full min-h-0 flex-col p-sm`;

export const monthCalendarFillClass = "flex h-full min-h-0 flex-1 flex-col";

export const calendarScrollableClass = "min-h-0 flex-1 overflow-auto";

export const monthGridContainerClass = "flex h-full min-h-0 flex-1 flex-col gap-xs";

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
  isWeekend: boolean;
};

export function monthDayCellClass({
  isCurrentMonth,
  activeDay,
  today,
}: MonthDayCellParams): string {
  const base =
    "flex h-full min-h-0 cursor-pointer flex-col items-stretch justify-start gap-0.5 overflow-hidden rounded-md border p-[3px_5px] transition-[border-color,box-shadow,background] duration-150";

  if (activeDay) {
    return `${base} border-accent bg-[color-mix(in_srgb,var(--accent)_12%,var(--surface-panel))] shadow-sm ${isCurrentMonth ? "opacity-100" : "opacity-[0.72]"}`;
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

export const monthDayHeaderClass =
  "flex h-4 shrink-0 items-center justify-between gap-0.5";

export function monthDayNumberClass({
  isCurrentMonth,
  today,
  activeDay,
}: Pick<MonthDayCellParams, "isCurrentMonth" | "today" | "activeDay">): string {
  const highlighted = (today || activeDay) && isCurrentMonth;
  if (!highlighted) {
    return [
      "flex h-4 shrink-0 items-center justify-center text-card-meta leading-none",
      isCurrentMonth ? "font-normal text-text-primary" : "font-normal text-text-muted",
    ].join(" ");
  }

  return [
    "flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full text-card-meta font-bold leading-none text-white",
    activeDay ? "bg-accent" : "bg-[color-mix(in_srgb,var(--accent)_72%,transparent)]",
  ].join(" ");
}

export const monthDayMetaClass = "flex min-w-0 shrink-0 items-center gap-[3px]";

export const monthTodayLabelClass = "text-card-meta font-semibold leading-none text-accent";

export const monthEventsPreviewClass =
  "flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden";

export const monthEventPreviewRowClass =
  "flex min-w-0 shrink-0 items-center gap-1";

/** 一般事件 — uses --calendar-dot-event (default: accent). */
export const monthEventDotClass =
  "h-1 w-1 shrink-0 rounded-full bg-[var(--calendar-dot-event)] opacity-80";

export const monthEventPreviewTextClass =
  "min-w-0 truncate text-card-meta leading-none text-text-secondary";

/** Compact span counters pinned to the bottom of the month cell (below event previews). */
export const monthSpanIndicatorsClass =
  "mt-auto flex min-w-0 shrink-0 flex-col gap-0.5 overflow-hidden";

export const monthSpanIndicatorRowClass =
  "flex min-w-0 shrink-0 items-center gap-1";

/** 進行中 — uses --calendar-dot-ongoing (default: info). */
export const monthSpanOngoingDotClass =
  "h-1 w-1 shrink-0 rounded-full bg-[var(--calendar-dot-ongoing)] opacity-90";

/** 结束 — uses --calendar-dot-ending (default: warning; not success — accent themes often collide). */
export const monthSpanEndingDotClass =
  "h-1 w-1 shrink-0 rounded-full bg-[var(--calendar-dot-ending)] opacity-90";

/** Span count text matches normal event preview text; only the dot is chromatic. */
export const monthSpanOngoingTextClass = monthEventPreviewTextClass;

export const monthSpanEndingTextClass = monthEventPreviewTextClass;

export function truncateMonthEventTitle(title: string, maxLength = 9): string {
  const trimmed = title.trim() || String(i18n.t("timeline:gantt.untitled"));
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}…`;
}

export function isWeekendDay(day: Date): boolean {
  const weekday = day.getDay();
  return weekday === 0 || weekday === 6;
}

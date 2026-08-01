export function getWeekCellClass({ isActive, isToday }: { isActive: boolean; isToday: boolean }): string {
  if (isActive) {
    return "min-h-20 cursor-pointer rounded-md border border-accent bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] p-2.5";
  }
  if (isToday) {
    return "im-card-hover min-h-20 cursor-pointer rounded-md border border-surface-border bg-[color-mix(in_srgb,var(--accent)_5%,transparent)] p-2.5";
  }
  return "im-card-hover min-h-20 cursor-pointer rounded-md border border-surface-border bg-surface-card p-2.5";
}

export const weekCellHeaderClass =
  "mb-sm flex items-center justify-between gap-sm";

export function weekCellDateClass(isToday: boolean): string {
  return [
    "text-xs text-text-primary",
    isToday ? "font-bold" : "font-normal",
  ].join(" ");
}

export const weekCellEventsContainerClass = "flex flex-col gap-1.5";

export const weekCellEmptyClass = "text-caption text-text-muted opacity-60";

export function dayEventCardClass(hovered: boolean): string {
  return [
    "cursor-pointer rounded-md border border-solid bg-surface-card p-md text-left text-text-primary transition-[border-color,box-shadow,transform] duration-150",
    hovered
      ? "-translate-y-px border-[color-mix(in_srgb,var(--accent)_35%,transparent)] shadow-sm"
      : "translate-y-0 border-surface-border shadow-none",
  ].join(" ");
}

export const dayCardPrimaryRowClass =
  "mb-1.5 flex justify-between gap-md font-semibold opacity-100";

export const dayCardSummaryClass =
  "mb-1 text-xs font-normal leading-snug text-text-secondary opacity-80";

export const dayCardMetadataClass = "text-caption font-normal opacity-60";

export const dayViewEmptyClass =
  "py-3xl text-center text-xs text-text-muted";

export const calendarDayHeaderClass = "text-section-title text-text-muted";

export const calendarDayGridClass = "grid gap-md";

export const calendarDayEventsGridClass = "grid gap-2.5";

export const weekViewHeaderGridClass = "mb-sm grid grid-cols-7 gap-sm";

export const weekViewWeekdayLabelClass = "text-center text-xs text-text-muted";

export const weekViewDayGridClass = "grid grid-cols-7 gap-sm";

export const weekCellMetaRowClass = "flex items-center gap-1.5";

export const weekCellTodayLabelClass = "text-card-meta text-accent";

export const weekCellEventCountClass = "text-card-meta text-text-muted opacity-60";

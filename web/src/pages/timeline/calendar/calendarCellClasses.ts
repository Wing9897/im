export function getWeekCellClass({ isActive, isToday }: { isActive: boolean; isToday: boolean }): string {
  const base =
    "flex min-h-[11rem] cursor-pointer flex-col rounded-lg border p-2 transition-[border-color,background-color] duration-150";
  if (isActive) {
    return `${base} border-accent bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]`;
  }
  if (isToday) {
    return `${base} im-card-hover border-surface-border bg-[color-mix(in_srgb,var(--accent)_5%,transparent)]`;
  }
  return `${base} im-card-hover border-surface-border bg-surface-card`;
}

export const weekCellHeaderClass =
  "mb-1.5 flex items-start justify-between gap-1";

export function weekCellDateClass(isToday: boolean): string {
  return [
    "flex h-7 w-7 items-center justify-center rounded-full text-sm tabular-nums",
    isToday
      ? "bg-accent font-semibold text-[color:var(--accent-contrast,white)]"
      : "font-medium text-text-primary",
  ].join(" ");
}

export const weekCellEventsContainerClass = "flex min-h-0 flex-1 flex-col gap-1";

export const weekCellEmptyClass = "mt-auto py-1 text-center text-[11px] text-text-muted opacity-50";

/** Compact week-view event chip (accent rail + title + time). */
export function weekEventChipClass(hovered: boolean): string {
  return [
    "group relative w-full cursor-pointer overflow-hidden rounded-md border border-solid p-0 text-left",
    "bg-[color-mix(in_srgb,var(--surface-card)_92%,transparent)]",
    "transition-[border-color,box-shadow] duration-150",
    hovered
      ? "border-[color-mix(in_srgb,var(--accent)_35%,transparent)] shadow-sm"
      : "border-surface-border",
  ].join(" ");
}

export const weekEventChipInnerClass = "flex min-w-0 gap-0";

export const weekEventChipRailClass = "w-0.5 shrink-0 self-stretch";

export const weekEventChipBodyClass = "min-w-0 flex-1 px-1.5 py-1";

export const weekEventChipTitleClass =
  "min-w-0 truncate text-[11px] font-medium leading-snug text-text-primary";

export const weekEventChipTimeClass =
  "mt-0.5 truncate text-[10px] font-medium tabular-nums leading-none text-text-muted";

export const weekCellOverflowClass =
  "mt-0.5 w-full border-none bg-transparent p-0 text-left text-[10px] font-medium text-accent";

/** Day-view event card shell (left accent rail + hover lift). */
export function dayEventCardClass(hovered: boolean): string {
  return [
    "group relative cursor-pointer overflow-hidden rounded-lg border border-solid",
    "bg-surface-card p-0 text-left text-text-primary",
    "transition-[border-color,box-shadow,transform] duration-150",
    hovered
      ? "-translate-y-px border-[color-mix(in_srgb,var(--accent)_40%,transparent)] shadow-md"
      : "translate-y-0 border-surface-border shadow-sm",
  ].join(" ");
}

export const dayCardInnerClass = "flex min-w-0 gap-0";

export const dayCardAccentRailClass =
  "w-1 shrink-0 self-stretch rounded-l-lg";

export const dayCardBodyClass = "min-w-0 flex-1 px-md py-sm";

export const dayCardPrimaryRowClass =
  "mb-1 flex min-w-0 items-start justify-between gap-md";

export const dayCardTitleClass =
  "min-w-0 flex-1 text-sm font-semibold leading-snug text-text-primary";

export const dayCardTimeChipClass =
  "shrink-0 rounded-md bg-[color-mix(in_srgb,var(--surface-border)_45%,transparent)] px-1.5 py-0.5 text-[11px] font-medium tabular-nums leading-none text-text-secondary";

export const dayCardSummaryClass =
  "mb-1.5 line-clamp-2 text-xs font-normal leading-snug text-text-secondary";

export const dayCardLocationRowClass =
  "mb-1.5 flex min-w-0 items-center gap-1 text-xs leading-snug text-text-secondary";

export const dayCardLocationIconClass = "shrink-0 opacity-70";

export const dayCardLocationTextClass = "min-w-0 truncate";

export const dayCardMetadataClass =
  "flex min-w-0 items-center justify-between gap-sm text-[11px] font-normal text-text-muted";

export const dayViewEmptyClass =
  "py-3xl text-center text-xs text-text-muted";

export const calendarDayHeaderClass = "text-section-title text-text-muted";

export const calendarDayGridClass = "grid gap-md";

export const calendarDayEventsGridClass = "grid gap-3";

export const weekViewHeaderGridClass = "mb-2 grid grid-cols-7 gap-2";

export const weekViewWeekdayLabelClass =
  "text-center text-[11px] font-medium uppercase tracking-wide text-text-muted";

export const weekViewDayGridClass = "grid grid-cols-7 gap-2";

export const weekCellMetaRowClass = "flex flex-col items-end gap-0.5";

export const weekCellTodayLabelClass = "text-[10px] font-medium text-accent";

export const weekCellEventCountClass = "text-[10px] text-text-muted opacity-70";

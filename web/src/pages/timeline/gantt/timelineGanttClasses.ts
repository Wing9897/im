import { dismissedTitleClass } from "../timelineDismissUtils";

/** Fill the timeline grid column; body scrolls vertically when rows overflow. */
export const ganttRootClass = "flex h-full min-h-0 flex-1 flex-col overflow-hidden";

export const ganttVerticalScrollClass =
  "im-auto-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto";

export const ganttMainFlexContainerClass = "flex min-h-0 min-w-0";

export const ganttLeftColumnClass =
  "z-[2] flex w-[156px] min-w-[156px] max-w-[156px] shrink-0 flex-col";

export const ganttEventNamesColumnClass = "flex min-w-0 flex-col gap-1.5";

export const ganttRightAreaBaseClass = "min-w-0 flex-1";

export const ganttEventBarRowsContainerClass = "flex flex-col gap-1.5";

export const ganttColumnHeaderTextClass =
  "text-center text-caption text-text-muted";

export const ganttLegendLabelClass = "text-xs text-text-secondary";

export const ganttEmptyStateClass =
  "px-lg py-14 text-center text-sm text-text-muted";

export const ganttErrorContainerClass = "px-lg py-10 text-center";

export const ganttErrorTextClass = "mb-md text-sm text-error";

export const ganttRetryButtonClass =
  "cursor-pointer rounded-lg border border-surface-border bg-[color-mix(in_srgb,var(--surface-base)_45%,transparent)] px-lg py-sm text-body text-text-primary";

/** Sticky with page surface so scrolling rows do not show through. */
export const ganttHeaderLabelClass =
  "sticky top-0 z-[3] mb-2 flex h-5 items-center bg-[color-mix(in_srgb,var(--surface-page)_96%,transparent)] pl-0.5 text-xs text-text-muted";

export const ganttLegendContainerClass =
  "mt-lg flex shrink-0 flex-wrap gap-lg border-t border-surface-border pt-md";

export const ganttLegendItemClass = "flex items-center gap-1.5";

export const ganttLegendDotBaseClass = "h-3.5 w-3.5 rounded-sm";

export function ganttEventNameClass(isHovered: boolean, dismissed = false): string {
  return [
    // Fixed row height + flex center (avoid h + py + leading fighting each other).
    "box-border flex h-7 w-full min-w-0 max-w-full shrink-0 cursor-pointer items-center truncate rounded-md px-2 text-caption font-medium leading-none",
    dismissed
      ? `${dismissedTitleClass} opacity-70`
      : "text-text-primary",
    // Soft translucent pill — readable without going fully solid.
    isHovered
      ? "bg-[color-mix(in_srgb,var(--accent-pink)_16%,color-mix(in_srgb,var(--surface-card)_58%,transparent))]"
      : "bg-[color-mix(in_srgb,var(--surface-card)_52%,transparent)]",
  ].join(" ");
}

/** Continuous event bar spanning grid columns (covers column gaps). */
export function ganttBarClass(
  isHovered: boolean,
  isPoint: boolean,
  dismissed = false,
): string {
  return [
    "relative z-[1] box-border h-[18px] self-center rounded-md border transition-[opacity,box-shadow,background] duration-150",
    dismissed
      ? "border-dashed border-error bg-[color-mix(in_srgb,var(--error)_48%,transparent)]"
      : "border-accent bg-accent",
    // Mid opacity: not washed-out ghost, not fully solid.
    isHovered ? "opacity-100 shadow-sm" : dismissed ? "opacity-60" : "opacity-80",
    isPoint ? "min-w-1.5" : "min-w-1",
  ].join(" ");
}

/** Row shell — no continuous fill; day cells provide the countable track. */
export function ganttEventRowClass(_isHovered: boolean): string {
  return "relative grid h-7 shrink-0 cursor-pointer items-center";
}

/** Per-day empty cell so users can count columns (days) visually. */
export function ganttDayCellClass(isHovered: boolean): string {
  return [
    "box-border h-full min-h-0 min-w-0 rounded-sm border border-[color-mix(in_srgb,var(--surface-border)_45%,transparent)]",
    isHovered
      ? "bg-[color-mix(in_srgb,var(--accent-pink)_14%,color-mix(in_srgb,var(--surface-card)_50%,transparent))]"
      : "bg-[color-mix(in_srgb,var(--surface-card)_40%,transparent)]",
  ].join(" ");
}

export const ganttRefreshRowClass =
  "flex shrink-0 justify-end px-0.5 pb-sm";

export const ganttTimeAxisGridClass =
  "sticky top-0 z-[3] mb-2.5 grid h-5 items-center bg-[color-mix(in_srgb,var(--surface-page)_96%,transparent)]";

export const ganttScrollInnerFullClass = "min-w-0 w-full";

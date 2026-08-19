import { dismissedTitleClass } from "../timelineDismissUtils";

/** Fill the timeline grid column; body scrolls vertically when rows overflow. */
export const ganttRootClass =
  "im-timeline-gantt flex h-full min-h-0 flex-1 flex-col overflow-hidden";

export const ganttVerticalScrollClass =
  "im-auto-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto";

export const ganttMainFlexContainerClass = "flex min-h-0 min-w-0";

export const ganttLeftColumnClass =
  "z-[2] flex w-[168px] min-w-[168px] max-w-[168px] shrink-0 flex-col border-r border-[color-mix(in_srgb,var(--surface-border)_58%,transparent)] pr-1.5";

export const ganttEventNamesColumnClass = "flex min-w-0 flex-col gap-0.5";

export const ganttRightAreaBaseClass = "min-w-0 flex-1";

export const ganttEventBarRowsContainerClass = "flex flex-col gap-0.5";

export const ganttColumnHeaderTextClass =
  "text-center text-caption font-medium tabular-nums text-text-secondary";

export function ganttColumnHeaderClass(isToday: boolean): string {
  return [
    ganttColumnHeaderTextClass,
    isToday
      ? "font-semibold text-[color-mix(in_srgb,var(--info)_88%,var(--text-primary))]"
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export const ganttLegendLabelClass =
  "text-xs text-[color-mix(in_srgb,var(--text-primary)_78%,var(--text-secondary))]";

export const ganttEmptyStateClass =
  "px-lg py-14 text-center text-sm text-text-muted";

export const ganttErrorContainerClass = "px-lg py-10 text-center";

export const ganttErrorTextClass = "mb-md text-sm text-error";

export const ganttRetryButtonClass =
  "im-surface-panel cursor-pointer rounded-lg border border-surface-border px-lg py-sm text-body text-text-primary";

/** Sticky chrome frost so scrolling rows do not punch through under photo BG. */
export const ganttHeaderLabelClass =
  "im-surface-chrome sticky top-0 z-[3] mb-2 flex h-5 items-center pl-0.5 text-xs font-medium text-text-secondary";

export const ganttLegendContainerClass =
  "mt-lg flex shrink-0 flex-wrap gap-lg border-t border-surface-border pt-md";

export const ganttLegendItemClass = "flex items-center gap-1.5";

export const ganttLegendDotBaseClass = "h-3.5 w-3.5 rounded-sm";

export const ganttLabelStatusDotClass =
  "h-1.5 w-1.5 shrink-0 rounded-full";

export const ganttLabelTitleClass = "min-w-0 flex-1 truncate";

export function ganttEventNameClass(isHovered: boolean, dismissed = false): string {
  return [
    // Fixed row height + flex center (avoid h + py + leading fighting each other).
    "box-border flex h-7 w-full min-w-0 max-w-full shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-1.5 text-caption font-medium leading-none",
    dismissed
      ? `${dismissedTitleClass} opacity-70`
      : "text-text-primary",
    isHovered
      ? "bg-[color-mix(in_srgb,var(--accent-pink)_12%,var(--surface-panel))]"
      : "bg-transparent hover:bg-[color-mix(in_srgb,var(--surface-panel)_72%,transparent)]",
  ].join(" ");
}

/**
 * Continuous Gantt bar. Color comes from inline status token (or dashed error for dismissed).
 * Compact = single-column / point events — short inset block, not a full-width capsule.
 */
export function ganttBarClass(
  isHovered: boolean,
  isCompact: boolean,
  dismissed = false,
): string {
  return [
    "relative z-[1] box-border h-[13px] self-center rounded-full transition-[opacity,box-shadow,filter] duration-150",
    dismissed
      ? "border border-dashed border-error bg-[color-mix(in_srgb,var(--error)_48%,transparent)]"
      : "border-0",
    isHovered ? "opacity-100 brightness-110 shadow-sm" : dismissed ? "opacity-55" : "opacity-92",
    isCompact ? "mx-[16%] min-w-[6px]" : "mx-px min-w-1",
  ].join(" ");
}

/** Row shell — hairline track only; no habit-grid capsules. */
export function ganttEventRowClass(isHovered: boolean): string {
  return [
    "relative grid h-7 shrink-0 cursor-pointer items-center",
    "border-b border-[color-mix(in_srgb,var(--surface-border)_52%,transparent)]",
    isHovered
      ? "bg-[color-mix(in_srgb,var(--accent-pink)_8%,transparent)]"
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Per-column slot: thin divider + optional today wash.
 * Intentionally no rounded capsule borders (those created habit-grid noise).
 */
export function ganttDayCellClass(isToday: boolean): string {
  return [
    "box-border h-full min-h-0 min-w-0 border-l border-[color-mix(in_srgb,var(--surface-border)_55%,transparent)]",
    isToday
      ? "bg-[color-mix(in_srgb,var(--info)_14%,transparent)]"
      : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export const ganttRefreshRowClass =
  "flex shrink-0 justify-end px-0.5 pb-sm";

export const ganttTimeAxisGridClass =
  "sticky top-0 z-[3] mb-1.5 grid h-5 items-center bg-[color-mix(in_srgb,var(--surface-card)_92%,transparent)]";

export const ganttScrollInnerFullClass = "min-w-0 w-full";

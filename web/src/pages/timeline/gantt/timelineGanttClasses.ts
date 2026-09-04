import { dismissedTitleClass } from "../timelineDismissUtils";
import {
  GANTT_AXIS_FOLLOW_GAP_CLASS,
  GANTT_AXIS_HEIGHT_CLASS,
  GANTT_LANE_HEIGHT_CLASS,
  GANTT_LANE_STACK_CLASS,
} from "./ganttGridLayout";

/** Fill the timeline grid column; body scrolls vertically when rows overflow. */
export const ganttRootClass =
  "im-timeline-gantt flex h-full min-h-0 flex-1 flex-col overflow-hidden";

export const ganttVerticalScrollClass =
  "im-auto-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto";

export const ganttMainFlexContainerClass = "flex min-h-0 min-w-0";

/** 全局: one CSS grid so label lanes and bar lanes share row tracks. */
export const ganttMainOverviewGridClass =
  "grid min-h-0 min-w-0 grid-cols-[168px_minmax(0,1fr)]";

export const ganttLeftColumnClass =
  "z-[2] flex w-[168px] min-w-[168px] max-w-[168px] shrink-0 flex-col border-r border-[color-mix(in_srgb,var(--surface-border)_58%,transparent)] pr-1.5";

export const ganttLeftColumnSubgridClass =
  "z-[2] col-start-1 row-span-full grid min-w-0 grid-rows-subgrid border-r border-[color-mix(in_srgb,var(--surface-border)_58%,transparent)] pr-1.5";

export const ganttEventNamesColumnClass = GANTT_LANE_STACK_CLASS;

export const ganttRightAreaBaseClass = "min-w-0 flex-1";

export const ganttEventBarRowsContainerClass = GANTT_LANE_STACK_CLASS;

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
export const ganttHeaderLabelClass = [
  "im-surface-chrome sticky top-0 z-[3] flex items-center pl-0.5 text-xs font-medium text-text-secondary",
  GANTT_AXIS_HEIGHT_CLASS,
  GANTT_AXIS_FOLLOW_GAP_CLASS,
].join(" ");

export const ganttLegendContainerClass =
  "mt-lg flex shrink-0 flex-wrap gap-lg border-t border-surface-border pt-md";

export const ganttLegendItemClass = "flex items-center gap-1.5";

export const ganttLegendDotBaseClass = "h-3.5 w-3.5 rounded-sm";

export const ganttLabelStatusDotClass =
  "h-1.5 w-1.5 shrink-0 rounded-full";

export const ganttLabelTitleClass = "min-w-0 flex-1 truncate";

export function ganttEventNameClass(isHovered: boolean, dismissed = false): string {
  return [
    // Fixed lane height + flex center (avoid h + py + leading fighting each other).
    `flex w-full min-w-0 max-w-full cursor-pointer items-center gap-1.5 rounded-md px-1.5 text-caption font-medium leading-none ${GANTT_LANE_HEIGHT_CLASS}`,
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
  layout: "grid" | "overlay" = "grid",
): string {
  return [
    layout === "overlay"
      ? "absolute top-1/2 z-[1] -translate-y-1/2"
      : "relative z-[1] self-center",
    "box-border h-[13px] rounded-full transition-[opacity,box-shadow,filter] duration-150",
    dismissed
      ? "border border-dashed border-error bg-[color-mix(in_srgb,var(--error)_48%,transparent)]"
      : "border-0",
    isHovered ? "opacity-100 brightness-110 shadow-sm" : dismissed ? "opacity-55" : "opacity-92",
    isCompact
      ? layout === "overlay"
        ? "mx-0 min-w-[6px]"
        : "mx-[16%] min-w-[6px]"
      : layout === "overlay"
        ? "mx-0 min-w-1"
        : "mx-px min-w-1",
  ].join(" ");
}

/** Row shell — hairline track only; no habit-grid capsules. */
export function ganttEventRowClass(isHovered: boolean): string {
  return [
    `relative grid cursor-pointer items-center ${GANTT_LANE_HEIGHT_CLASS}`,
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

export const ganttTimeAxisGridClass = [
  "sticky top-0 z-[3] grid items-center bg-[color-mix(in_srgb,var(--surface-card)_92%,transparent)]",
  GANTT_AXIS_HEIGHT_CLASS,
  GANTT_AXIS_FOLLOW_GAP_CLASS,
].join(" ");

export const ganttScrollInnerFullClass = "min-w-0 w-full";

export const ganttOverviewPanelClass =
  "relative col-start-2 row-span-full grid min-h-0 min-w-0 grid-rows-subgrid";

export const ganttOverviewTrackClass =
  "relative col-span-full row-span-full grid min-h-0 min-w-0 cursor-grab touch-none grid-rows-subgrid overflow-x-clip active:cursor-grabbing";

export const ganttOverviewAxisClass = [
  "relative sticky top-0 z-[3] overflow-hidden bg-[color-mix(in_srgb,var(--surface-card)_92%,transparent)]",
  GANTT_AXIS_HEIGHT_CLASS,
  GANTT_AXIS_FOLLOW_GAP_CLASS,
].join(" ");

export const ganttOverviewGridLineClass =
  "absolute top-0 h-full w-px bg-[color-mix(in_srgb,var(--surface-border)_55%,transparent)]";

export const ganttOverviewGridOverlayClass =
  "pointer-events-none absolute inset-0 z-0";

export function ganttOverviewTickClass(major: boolean): string {
  return [
    "absolute top-0 -translate-x-1/2 whitespace-nowrap text-caption tabular-nums",
    major ? "font-semibold text-text-secondary" : "text-text-muted",
  ].join(" ");
}

export const ganttOverviewNowMarkerClass =
  "pointer-events-none absolute top-0 z-[1] h-full w-px bg-[color-mix(in_srgb,var(--info)_70%,transparent)]";

export function ganttOverviewTrackRowClass(isHovered: boolean): string {
  return [
    `relative cursor-pointer ${GANTT_LANE_HEIGHT_CLASS}`,
    "border-b border-[color-mix(in_srgb,var(--surface-border)_52%,transparent)]",
    isHovered ? "bg-[color-mix(in_srgb,var(--accent-pink)_8%,transparent)]" : "",
  ].join(" ");
}

export const ganttOverviewTimebarPanelClass =
  "flex shrink-0 flex-col gap-0.5 border-t border-surface-border px-1 pb-1 pt-1.5";

export const ganttOverviewTimebarWrapClass = "relative w-full";

export const ganttOverviewTimebarCanvasClass = "block h-[44px] w-full";

export const ganttOverviewTimebarHandleClass =
  "pointer-events-none absolute top-0 h-[44px] w-[18px] -translate-x-1/2 bg-transparent";

export const ganttOverviewTimebarTickRowClass = "relative h-4 overflow-hidden";

export const ganttOverviewTimebarTickClass =
  "absolute top-0 -translate-x-1/2 whitespace-nowrap text-card-meta text-text-muted";

export const ganttOverviewTimebarLabelClass =
  "whitespace-nowrap px-0.5 text-caption font-semibold text-accent-pink";


import type React from "react";
import { spacing } from "../../../styles/tokens";

export const timelineSkeletonInactiveBarClass =
  "h-[22px] rounded-md bg-[color-mix(in_srgb,var(--surface-border)_14%,transparent)]";

export const timelineSkeletonCalendarGridClass =
  "grid grid-cols-7 gap-sm";

export const timelineSkeletonCalendarHeaderRowClass =
  `${timelineSkeletonCalendarGridClass} mb-sm`;

export const timelineSkeletonCalendarCellClass =
  "flex min-h-[160px] flex-col gap-sm rounded-[14px] border border-surface-border bg-[color-mix(in_srgb,var(--surface-base)_45%,transparent)] p-2.5";

export const timelineSkeletonCellHeaderClass =
  "flex items-center justify-between";

export const timelineSkeletonCenteredFlexClass = "flex justify-center";

export const timelineSkeletonGanttRowsContainerClass = "flex flex-col gap-sm";

export const timelineSkeletonGanttScrollContainerClass = "overflow-x-auto";

export const timelineSkeletonGanttInnerClass = "min-w-[700px]";

const timelineSkeletonGanttTimeAxisGridClass =
  "mb-2.5 grid items-center";

export const timelineSkeletonShimmerClass = "im-shimmer rounded-md";

export function timelineSkeletonGanttHeaderGridClass(columnCount: number): string {
  void columnCount;
  return timelineSkeletonGanttTimeAxisGridClass;
}

export function timelineSkeletonGanttHeaderGridStyle(columnCount: number): React.CSSProperties {
  return {
    gridTemplateColumns: `148px repeat(${columnCount}, minmax(22px, 1fr))`,
    gap: spacing.xs,
  };
}

export function timelineSkeletonGanttRowGridStyle(columnCount: number): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: `148px repeat(${columnCount}, minmax(22px, 1fr))`,
    gap: spacing.xs,
    alignItems: "center",
  };
}

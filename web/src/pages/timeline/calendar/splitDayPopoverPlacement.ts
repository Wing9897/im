export const SPLIT_DAY_POPOVER_GAP = 4;
export const SPLIT_DAY_POPOVER_EDGE = 8;

export type SplitDayPopoverPlacement = {
  top: number;
  left: number;
  maxHeight: number;
  placement: "below" | "above";
};

type AnchorBox = {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Viewport-fixed placement for the split-month day popover.
 * Flips above when the measured panel does not fit below and there is more
 * room above; clamps left/right; caps height so chrome stays on-screen.
 */
export function placeSplitDayPopover({
  anchor,
  popoverWidth,
  popoverHeight,
  viewportWidth,
  viewportHeight,
  gap = SPLIT_DAY_POPOVER_GAP,
  edge = SPLIT_DAY_POPOVER_EDGE,
}: {
  anchor: AnchorBox;
  popoverWidth: number;
  popoverHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  gap?: number;
  edge?: number;
}): SplitDayPopoverPlacement {
  const spaceBelow = viewportHeight - anchor.bottom - edge;
  const spaceAbove = anchor.top - edge;
  const needsFlip = popoverHeight + gap > spaceBelow && spaceAbove > spaceBelow;
  const placement: "below" | "above" = needsFlip ? "above" : "below";
  const available = Math.max(0, (placement === "below" ? spaceBelow : spaceAbove) - gap);
  const maxHeight = popoverHeight > 0 ? Math.min(popoverHeight, available) : available;
  const usedHeight = popoverHeight > 0 ? Math.min(popoverHeight, Math.max(maxHeight, 0)) : 0;

  let top =
    placement === "above"
      ? anchor.top - gap - usedHeight
      : anchor.bottom + gap;
  const maxTop = Math.max(edge, viewportHeight - usedHeight - edge);
  top = clamp(top, edge, maxTop);

  const width = Math.max(0, popoverWidth);
  const maxLeft = Math.max(edge, viewportWidth - width - edge);
  const left = clamp(anchor.left + anchor.width / 2 - width / 2, edge, maxLeft);

  return { top, left, maxHeight, placement };
}

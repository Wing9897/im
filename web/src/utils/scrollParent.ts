/** True when the element scrolls vertically via overflow. */
function isVerticalScrollContainer(node: HTMLElement): boolean {
  const { overflowY } = getComputedStyle(node);
  return overflowY === "auto" || overflowY === "scroll";
}

/**
 * Nearest vertical scroll container, including `node` itself when it scrolls.
 * (Previously skipped `node`, which broke DataList-as-root infinite scroll.)
 */
export function getVerticalScrollParent(node: HTMLElement | null): HTMLElement | null {
  let current = node;
  while (current) {
    if (isVerticalScrollContainer(current)) {
      return current;
    }
    current = current.parentElement;
  }
  return null;
}

export interface ScrollViewportRange {
  visibleTop: number;
  visibleBottom: number;
}

/**
 * Maps a scroll container's viewport to offsets within `containerNode`.
 * Used by virtualized lists where `window.scrollY` is always 0 (app shell scroll).
 */
export function getScrollViewportRangeInContainer(
  containerNode: HTMLElement,
  bufferPx = 0,
): ScrollViewportRange {
  const scrollParent = getVerticalScrollParent(containerNode);

  // Container itself is the scroll root (e.g. DataList max-h + overflow-y-auto).
  if (scrollParent === containerNode) {
    const top = containerNode.scrollTop;
    const bottom = top + containerNode.clientHeight;
    return {
      visibleTop: Math.max(0, top - bufferPx),
      visibleBottom: bottom + bufferPx,
    };
  }

  const containerRect = containerNode.getBoundingClientRect();
  const rootRect = scrollParent?.getBoundingClientRect();
  const viewportTop = rootRect?.top ?? 0;
  const viewportBottom = rootRect?.bottom ?? viewportTop + 800;

  const visibleTop = Math.max(0, viewportTop - containerRect.top - bufferPx);
  const visibleBottom = Math.max(
    visibleTop,
    viewportBottom - containerRect.top + bufferPx,
  );

  return { visibleTop, visibleBottom };
}

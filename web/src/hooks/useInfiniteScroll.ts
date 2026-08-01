import { useEffect, useRef } from "react";

import { getVerticalScrollParent } from "../utils/scrollParent";

interface UseInfiniteScrollOptions {
  /** The sentinel DOM node to observe. When it enters the viewport, `onLoadMore` fires. */
  triggerNode: HTMLElement | null;
  /** Called when the sentinel becomes visible. Should trigger loading more data. */
  onLoadMore: () => void | Promise<void>;
  /** When true, the observer is not attached (e.g. during initial load). */
  disabled?: boolean;
  /** Optional scroll container element to use as the IntersectionObserver root. */
  root?: Element | null;
  /** Root margin for the IntersectionObserver. Defaults to bottom prefetch only. */
  rootMargin?: string;
}

/**
 * Attaches an IntersectionObserver to a sentinel node and calls `onLoadMore`
 * when the node enters the viewport. Commonly used for infinite-scroll lists.
 *
 * Important:
 * - Do **not** flip `disabled` for in-flight loads — remounting the observer
 *   while the sentinel stays visible re-fires immediately and can chain pages.
 * - Do **not** unobserve/reobserve after each load for the same reason.
 * - After a load, the sentinel must leave the root (user scrolls away) before
 *   another automatic load can fire. Manual “load more” buttons bypass this.
 */
export function useInfiniteScroll({
  triggerNode,
  onLoadMore,
  disabled = false,
  root = null,
  rootMargin = "0px 0px 240px 0px",
}: UseInfiniteScrollOptions): void {
  const onLoadMoreRef = useRef(onLoadMore);
  onLoadMoreRef.current = onLoadMore;

  useEffect(() => {
    if (!triggerNode || disabled) return;

    const resolvedRoot = root ?? getVerticalScrollParent(triggerNode);
    let cancelled = false;
    let inFlight = false;
    // Rising-edge only: one auto-load per time the sentinel becomes visible.
    let armed = true;

    const observer = new IntersectionObserver(
      (entries) => {
        if (cancelled) return;
        const intersecting = entries.some((entry) => entry.isIntersecting);
        if (!intersecting) {
          armed = true;
          return;
        }
        if (!armed || inFlight) return;

        armed = false;
        inFlight = true;
        void (async () => {
          try {
            await onLoadMoreRef.current();
          } finally {
            inFlight = false;
          }
        })();
      },
      { root: resolvedRoot, rootMargin },
    );

    observer.observe(triggerNode);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [triggerNode, disabled, root, rootMargin]);
}

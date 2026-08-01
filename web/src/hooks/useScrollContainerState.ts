import { useEffect, useState } from "react";

import { getVerticalScrollParent } from "../utils/scrollParent";

interface UseScrollContainerStateOptions {
  enabled?: boolean;
  /** Extra values that should trigger a layout recalculation (e.g. item count). */
  extraDeps?: readonly unknown[];
}

/**
 * Tracks the nearest scroll parent for an anchor node and bumps `tick` on scroll/resize.
 * Pair with virtual list helpers that read getBoundingClientRect during render.
 */
export function useScrollContainerState(
  anchorNode: HTMLElement | null,
  { enabled = true, extraDeps = [] }: UseScrollContainerStateOptions = {},
): { scrollParent: HTMLElement | null; tick: number } {
  const [scrollParent, setScrollParent] = useState<HTMLElement | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!anchorNode) {
      setScrollParent(null);
      return;
    }
    setScrollParent(getVerticalScrollParent(anchorNode));
  }, [anchorNode]);

  useEffect(() => {
    if (!enabled || !anchorNode) return;
    setTick((value) => value + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller-controlled deps
  }, [anchorNode, enabled, ...extraDeps]);

  useEffect(() => {
    if (!enabled) return;

    let rafId = 0;
    const bump = () => {
      if (rafId !== 0) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        setTick((value) => value + 1);
      });
    };

    const scrollTarget = scrollParent ?? window;
    scrollTarget.addEventListener("scroll", bump, { passive: true });
    window.addEventListener("resize", bump);
    return () => {
      if (rafId !== 0) window.cancelAnimationFrame(rafId);
      scrollTarget.removeEventListener("scroll", bump);
      window.removeEventListener("resize", bump);
    };
  }, [enabled, scrollParent]);

  return { scrollParent, tick };
}

import { useLayoutEffect, useRef, useState, type RefObject } from "react";
import { BOARD_DESIGN_HEIGHT, BOARD_DESIGN_WIDTH } from "./boardSizePresets";

export type BoardStretchScale = { x: number; y: number };

/**
 * Measure the canvas element and compute stretch scale vs the 16×10 design size.
 * Returns null until the first positive measure (avoids a clipped mosaic at scale 1).
 */
export function useBoardStretchScale(
  canvasRef: RefObject<HTMLDivElement | null>,
  deps: readonly unknown[],
): BoardStretchScale | null {
  const [scale, setScale] = useState<BoardStretchScale | null>(null);

  useLayoutEffect(() => {
    const el = canvasRef.current;
    if (!el) {
      return;
    }
    let raf = 0;
    const applySize = (w: number, h: number) => {
      if (w <= 0 || h <= 0) {
        return false;
      }
      const nextX = w / BOARD_DESIGN_WIDTH;
      const nextY = h / BOARD_DESIGN_HEIGHT;
      setScale((prev) =>
        prev && prev.x === nextX && prev.y === nextY ? prev : { x: nextX, y: nextY },
      );
      return true;
    };
    const updateFromElement = () => {
      if (applySize(el.clientWidth, el.clientHeight)) {
        return;
      }
      raf = window.requestAnimationFrame(updateFromElement);
    };
    updateFromElement();
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        const { width, height } = entry.contentRect;
        if (applySize(width, height)) {
          return;
        }
      }
      updateFromElement();
    });
    ro.observe(el);
    const vv = window.visualViewport;
    vv?.addEventListener("resize", updateFromElement);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      ro.disconnect();
      vv?.removeEventListener("resize", updateFromElement);
    };
    // Caller passes identity-stable deps (widget count, monitor mode, …).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional external deps list
  }, deps);

  return scale;
}

/** Keep scale refs in sync for drag handlers that read latest scale without rebinding. */
export function useBoardScaleRefs(scale: BoardStretchScale | null): {
  scaleXRef: RefObject<number>;
  scaleYRef: RefObject<number>;
} {
  const scaleXRef = useRef(1);
  const scaleYRef = useRef(1);
  if (scale != null) {
    scaleXRef.current = scale.x;
    scaleYRef.current = scale.y;
  }
  return { scaleXRef, scaleYRef };
}

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";

import {
  OVERVIEW_ZOOM_FACTOR,
  panOverviewWindow,
  panDeltaMsFromPointer,
  zoomOverviewWindowAtPx,
  type GanttOverviewWindow,
} from "../../../domain/gantt/ganttOverviewWindow";

const OVERVIEW_PAN_THRESHOLD_PX = 3;

/**
 * Wheel/pinch zoom (ctrl+wheel) and empty-track pan for 全局/Overview mode.
 * Event-bar pointerdowns must stopPropagation so they do not start a pan.
 */
export function useGanttOverviewPanZoom(args: {
  window: GanttOverviewWindow;
  onChange: (next: GanttOverviewWindow) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef(args.window);
  windowRef.current = args.window;
  const onChangeRef = useRef(args.onChange);
  onChangeRef.current = args.onChange;

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = el.getBoundingClientRect();
      const cursorX = event.clientX - rect.left;
      const factor = event.deltaY > 0 ? OVERVIEW_ZOOM_FACTOR : 1 / OVERVIEW_ZOOM_FACTOR;
      onChangeRef.current(zoomOverviewWindowAtPx(windowRef.current, rect.width, cursorX, factor));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const beginPan = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("[data-testid^='event-bar-']")) {
      return;
    }
    event.preventDefault();
    const origin = windowRef.current;
    const startX = event.clientX;
    const width = trackRef.current?.clientWidth ?? 0;
    let dragged = false;

    const onMove = (moveEvent: PointerEvent) => {
      const dx = moveEvent.clientX - startX;
      if (!dragged && Math.abs(dx) < OVERVIEW_PAN_THRESHOLD_PX) return;
      dragged = true;
      const deltaMs = panDeltaMsFromPointer(dx, width, origin.spanMs);
      onChangeRef.current(panOverviewWindow(origin, deltaMs));
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  return { trackRef, beginPan };
}

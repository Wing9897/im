import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";

import {
  applyDragMove,
  dragDeltaMs,
  wheelZoomViewport,
  type DragGestureState,
} from "../../../domain/intelligence/timelineSliderGestureGeometry";
import {
  CANVAS_H,
  ONE_HOUR,
  clamp,
  draw,
  hitTest,
  type HitZone,
} from "../../../domain/intelligence/timelineSliderLayout";
import {
  OVERVIEW_MAX_SPAN_MS,
  OVERVIEW_MIN_SPAN_MS,
  clampOverviewWindow,
  minOverviewTickLabelPct,
  overviewWindowEndMs,
  ticksForOverviewWindow,
  type GanttOverviewWindow,
} from "../../../domain/gantt/ganttOverviewWindow";

function selectionToWindow(start: number, end: number): GanttOverviewWindow {
  return clampOverviewWindow({
    startMs: start,
    spanMs: Math.max(end - start, OVERVIEW_MIN_SPAN_MS),
  });
}

function overviewSpanFor(window: GanttOverviewWindow): number {
  return clamp(window.spanMs * 3, 48 * ONE_HOUR, OVERVIEW_MAX_SPAN_MS);
}

/**
 * Map-page timebar gestures for the gantt 全局/Overview footer:
 * drag the window, resize handles, pan/zoom the overview canvas.
 */
export function useGanttOverviewTimebar(args: {
  overviewWindow: GanttOverviewWindow;
  onChange: (next: GanttOverviewWindow) => void;
  onCommit?: () => void;
  dataMinMs?: number;
  dataMaxMs?: number;
}) {
  const { overviewWindow, onChange, onCommit, dataMinMs, dataMaxMs } = args;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [canvasW, setCanvasW] = useState(600);
  const [viewStart, setViewStart] = useState(
    () =>
      overviewWindow.startMs + overviewWindow.spanMs / 2 - overviewSpanFor(overviewWindow) / 2,
  );
  const [viewSpan, setViewSpan] = useState(() => overviewSpanFor(overviewWindow));
  const dragZone = useRef<HitZone | null>(null);
  const dragState = useRef<DragGestureState | null>(null);
  const [focusedHandle, setFocusedHandle] = useState<"left" | "right" | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onCommitRef = useRef(onCommit);
  onCommitRef.current = onCommit;

  const wS = overviewWindow.startMs;
  const wE = overviewWindowEndMs(overviewWindow);
  const dataMin = dataMinMs ?? wS;
  const dataMax = dataMaxMs ?? wE;

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setCanvasW(entry.contentRect.width);
    });
    observer.observe(wrap);
    setCanvasW(wrap.clientWidth);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const viewEnd = viewStart + viewSpan;
    if (wE < viewStart || wS > viewEnd) {
      setViewStart(wS + (wE - wS) / 2 - viewSpan / 2);
    } else if (wE - wS > viewSpan * 0.92) {
      const nextSpan = overviewSpanFor(overviewWindow);
      setViewSpan(nextSpan);
      setViewStart(wS + (wE - wS) / 2 - nextSpan / 2);
    }
  }, [overviewWindow, viewSpan, viewStart, wE, wS]);

  const viewWindow = useMemo(
    () => ({ startMs: viewStart, spanMs: viewSpan }),
    [viewStart, viewSpan],
  );
  const tsToX = useCallback(
    (ts: number) => ((ts - viewStart) / viewSpan) * canvasW,
    [canvasW, viewSpan, viewStart],
  );
  const tsPct = useCallback(
    (ts: number) => ((ts - viewStart) / viewSpan) * 100,
    [viewSpan, viewStart],
  );
  const ticks = useMemo(
    () => ticksForOverviewWindow(viewWindow, 16, minOverviewTickLabelPct(canvasW)),
    [canvasW, viewWindow],
  );
  const tickMarks = useMemo(() => ticks.map((tick) => tick.ms), [ticks]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasW * dpr;
    canvas.height = CANVAS_H * dpr;
    let ctx: CanvasRenderingContext2D | null = null;
    try {
      ctx = canvas.getContext("2d");
    } catch {
      return;
    }
    if (!ctx) return;
    const toX = (ts: number) => ((ts - viewStart) / viewSpan) * canvasW;
    draw(
      ctx,
      canvasW,
      toX(wS),
      toX(wE),
      dragZone.current ?? focusedHandle,
      tickMarks,
      viewStart,
      viewSpan,
      toX(dataMin),
      toX(dataMax),
    );
  }, [canvasW, dataMax, dataMin, focusedHandle, tickMarks, viewSpan, viewStart, wE, wS]);

  const onMouseDown = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const x = event.clientX - canvas.getBoundingClientRect().left;
      const zone = hitTest(x, tsToX(wS), tsToX(wE));
      event.preventDefault();
      dragState.current = {
        zone,
        startX: event.clientX,
        origWS: wS,
        origWE: wE,
        origViewStart: viewStart,
        origViewSpan: viewSpan,
      };
      dragZone.current = zone;
      canvas.style.cursor = zone === "left" || zone === "right" ? "ew-resize" : "grabbing";
    },
    [tsToX, viewSpan, viewStart, wE, wS],
  );

  useEffect(() => {
    const move = (event: MouseEvent) => {
      const state = dragState.current;
      if (!state) return;
      const delta = dragDeltaMs(event.clientX, state, canvasW);
      const result = applyDragMove(state, delta);
      if (result.kind === "pan") {
        setViewStart(result.viewStart);
        return;
      }
      onChangeRef.current(selectionToWindow(result.start, result.end));
    };
    const up = () => {
      if (!dragState.current) return;
      dragState.current = null;
      dragZone.current = null;
      if (canvasRef.current) canvasRef.current.style.cursor = "default";
      onCommitRef.current?.();
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [canvasW]);

  const onWheel = useCallback(
    (event: React.WheelEvent) => {
      event.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = event.clientX - rect.left;
      const next = wheelZoomViewport(viewStart, viewSpan, canvasW, x, event.deltaY);
      setViewSpan(next.viewSpan);
      setViewStart(next.viewStart);
    },
    [canvasW, viewSpan, viewStart],
  );

  const onHover = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      if (dragState.current || !canvasRef.current) return;
      const x = event.clientX - canvasRef.current.getBoundingClientRect().left;
      const zone = hitTest(x, tsToX(wS), tsToX(wE));
      canvasRef.current.style.cursor =
        zone === "left" || zone === "right" ? "ew-resize" : "grab";
    },
    [tsToX, wE, wS],
  );

  return {
    canvasRef,
    wrapRef,
    wS,
    wE,
    ticks,
    viewWindow,
    tsPct,
    canvasW,
    focusedHandle,
    setFocusedHandle,
    onMouseDown,
    onHover,
    onWheel,
    keyboardHandleStyle: (timestamp: number) => ({
      left: `${clamp(tsPct(timestamp), 0, 100)}%`,
    }),
  };
}

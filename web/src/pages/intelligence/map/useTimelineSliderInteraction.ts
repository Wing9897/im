import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import type { TimeWindow } from "../../../types";
import { formatDateOnly } from "../../../utils/dateFormat";
import {
  applyDragMove,
  calendarNoonMs,
  clampHandleCommit,
  dragDeltaMs,
  handleKeyNextMs,
  liveViewportSpanMs,
  wheelZoomViewport,
  type DragGestureState,
} from "../../../domain/intelligence/timelineSliderGestureGeometry";
import {
  CANVAS_H,
  ONE_HOUR,
  clamp,
  draw,
  genTicks,
  hitTest,
  type HitZone,
} from "../../../domain/intelligence/timelineSliderLayout";
import { useTimelineSliderWindowDraft } from "./useTimelineSliderWindowDraft";

export { liveViewportSpanMs };

interface Options {
  dataRange: TimeWindow;
  timeWindow: TimeWindow;
  liveMode: boolean;
  /** Half-width of the selection when jumping via the date picker (ms). */
  selectionHalfMs: number;
  /** Per-frame scrub preview — client filter only, must NOT trigger API fetch. */
  onTimeWindowChange: (window: TimeWindow) => void;
  /** Mouseup / calendar / keyboard commit — safe to refetch map window. */
  onCommitFetchWindow?: (window: TimeWindow) => void;
  /** Exit live mode once (idempotent) — must NOT toggle. */
  onExitLiveMode: () => void;
}

/**
 * Timeline slider gestures + canvas viewport.
 * Draft/preview/commit window data lives in `useTimelineSliderWindowDraft`.
 */
export function useTimelineSliderInteraction({
  dataRange,
  timeWindow,
  liveMode,
  selectionHalfMs,
  onTimeWindowChange,
  onCommitFetchWindow,
  onExitLiveMode,
}: Options) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [canvasW, setCanvasW] = useState(600);
  const dataMin = dataRange.start.getTime();
  const dataMax = dataRange.end.getTime();
  const propWS = timeWindow.start.getTime();
  const propWE = timeWindow.end.getTime();

  const {
    draft,
    exitLiveIfNeeded,
    emitDraft,
    commitWindow,
    commitFetch,
    cancelPreviewFrame,
    clearDraftAfterGesture,
  } = useTimelineSliderWindowDraft({
    onTimeWindowChange,
    onCommitFetchWindow,
    onExitLiveMode,
    liveMode,
  });

  const wS = draft?.start ?? propWS;
  const wE = draft?.end ?? propWE;

  const initialSpan = liveMode
    ? liveViewportSpanMs(selectionHalfMs)
    : Math.max((dataMax - dataMin) * 1.5, 48 * ONE_HOUR);
  const [viewStart, setViewStart] = useState(() =>
    liveMode ? (propWS + propWE) / 2 - initialSpan / 2 : (dataMin + dataMax) / 2 - initialSpan / 2,
  );
  const [viewSpan, setViewSpan] = useState(initialSpan);
  const dragZone = useRef<HitZone | null>(null);
  const dragState = useRef<DragGestureState | null>(null);
  const [focusedHandle, setFocusedHandle] = useState<"left" | "right" | null>(null);

  const selectionHalfMsRef = useRef(selectionHalfMs);
  selectionHalfMsRef.current = selectionHalfMs;

  // Viewport is user-controlled (pan / wheel) + Live recenter.
  // Do NOT auto-fit to dataRange on leave-Live or fetch expansion — that caused
  // the axis to jump from ~36h to dataSpan×1.5 (~1 week) mid-drag / after first drag.

  // Recenter the canvas viewport when Live advances the selection — not while dragging.
  useEffect(() => {
    if (!liveMode || draft) return;
    const span = liveViewportSpanMs(selectionHalfMs);
    setViewStart((propWS + propWE) / 2 - span / 2);
    setViewSpan(span);
  }, [liveMode, propWE, propWS, draft, selectionHalfMs]);

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

  const viewEnd = viewStart + viewSpan;
  const tsToX = useCallback(
    (ts: number) => ((ts - viewStart) / viewSpan) * canvasW,
    [canvasW, viewSpan, viewStart],
  );
  const tsPct = useCallback(
    (ts: number) => ((ts - viewStart) / viewSpan) * 100,
    [viewSpan, viewStart],
  );
  const ticks = useMemo(() => genTicks(viewStart, viewEnd, 20), [viewEnd, viewStart]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasW * dpr;
    canvas.height = CANVAS_H * dpr;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const toX = (ts: number) => ((ts - viewStart) / viewSpan) * canvasW;
    draw(
      ctx,
      canvasW,
      toX(wS),
      toX(wE),
      dragZone.current ?? focusedHandle,
      ticks,
      viewStart,
      viewSpan,
      toX(dataMin),
      toX(dataMax),
    );
  }, [canvasW, dataMax, dataMin, focusedHandle, ticks, viewSpan, viewStart, wE, wS]);

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
        // Panning away from Live is browsing history — leave Live once.
        exitLiveIfNeeded();
        setViewStart(result.viewStart);
        return;
      }
      emitDraft(result.start, result.end);
    };
    const up = () => {
      if (!dragState.current) return;
      const wasSelecting = dragState.current.zone !== "bg";
      dragState.current = null;
      dragZone.current = null;
      if (canvasRef.current) canvasRef.current.style.cursor = "default";
      if (wasSelecting) {
        const finalDraft = clearDraftAfterGesture();
        if (finalDraft) commitFetch(finalDraft.start, finalDraft.end);
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      cancelPreviewFrame();
    };
  }, [
    canvasW,
    cancelPreviewFrame,
    clearDraftAfterGesture,
    commitFetch,
    emitDraft,
    exitLiveIfNeeded,
  ]);

  const onWheel = useCallback(
    (event: React.WheelEvent) => {
      event.preventDefault();
      exitLiveIfNeeded();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = event.clientX - rect.left;
      const next = wheelZoomViewport(viewStart, viewSpan, canvasW, x, event.deltaY);
      setViewSpan(next.viewSpan);
      setViewStart(next.viewStart);
    },
    [canvasW, exitLiveIfNeeded, viewSpan, viewStart],
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

  const onCalendarChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const noon = calendarNoonMs(event.target.value);
      if (noon == null) return;
      const half = Math.max(selectionHalfMsRef.current, ONE_HOUR);
      setViewStart(noon - viewSpan / 2);
      commitWindow(noon - half, noon + half);
    },
    [commitWindow, viewSpan],
  );

  const sliderMin = Math.min(viewStart, dataMin, wS);
  const sliderMax = Math.max(viewEnd, dataMax, wE);

  const onHandleKeyDown = useCallback(
    (handle: "start" | "end", event: React.KeyboardEvent<HTMLDivElement>) => {
      const current = handle === "start" ? wS : wE;
      const next = handleKeyNextMs(
        handle,
        event.key,
        event.shiftKey,
        current,
        wS,
        wE,
        sliderMin,
        sliderMax,
      );
      if (next == null) return;
      event.preventDefault();
      const committed = clampHandleCommit(handle, next, wS, wE, sliderMin, sliderMax);
      commitWindow(committed.start, committed.end);
    },
    [commitWindow, sliderMax, sliderMin, wE, wS],
  );

  /** Date picker follows the selection center (not the pan viewport). */
  const selectionCenterDate = formatDateOnly((wS + wE) / 2);

  return {
    canvasRef,
    wrapRef,
    wS,
    wE,
    ticks,
    tsPct,
    sliderMin,
    sliderMax,
    viewStart,
    viewSpan,
    viewCenterDate: selectionCenterDate,
    keyboardHandleStyle: (timestamp: number) => ({
      left: `${clamp(tsPct(timestamp), 0, 100)}%`,
    }),
    focusedHandle,
    setFocusedHandle,
    onMouseDown,
    onHover,
    onWheel,
    onCalendarChange,
    onHandleKeyDown,
  };
}

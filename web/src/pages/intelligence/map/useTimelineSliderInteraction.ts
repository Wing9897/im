import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import type { TimeWindow } from "../../../types";
import { formatDateOnly } from "../../../utils/dateFormat";
import {
  CANVAS_H,
  ONE_DAY,
  ONE_HOUR,
  clamp,
  draw,
  genTicks,
  hitTest,
  type HitZone,
} from "./timelineSliderLayout";

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

/** Viewport span while Live — slightly wider than the ±Nh selection. */
export function liveViewportSpanMs(selectionHalfMs: number): number {
  const selection = Math.max(selectionHalfMs, ONE_HOUR) * 2;
  return Math.max(selection * 1.5, selection + 6 * ONE_HOUR);
}

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

  /** Local draft while dragging — avoids parent thrash / live re-center fighting the pointer. */
  const [draft, setDraft] = useState<{ start: number; end: number } | null>(null);
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
  const dragState = useRef<{
    zone: HitZone;
    startX: number;
    origWS: number;
    origWE: number;
    origViewStart: number;
    /** Freeze span for the whole gesture so mid-drag rescale cannot warp delta. */
    origViewSpan: number;
  } | null>(null);
  const [focusedHandle, setFocusedHandle] = useState<"left" | "right" | null>(null);

  const liveModeRef = useRef(liveMode);
  liveModeRef.current = liveMode;
  const onExitLiveModeRef = useRef(onExitLiveMode);
  onExitLiveModeRef.current = onExitLiveMode;
  const onTimeWindowChangeRef = useRef(onTimeWindowChange);
  onTimeWindowChangeRef.current = onTimeWindowChange;
  const onCommitFetchWindowRef = useRef(onCommitFetchWindow);
  onCommitFetchWindowRef.current = onCommitFetchWindow;
  const selectionHalfMsRef = useRef(selectionHalfMs);
  selectionHalfMsRef.current = selectionHalfMs;

  const exitLiveIfNeeded = useCallback(() => {
    if (liveModeRef.current) {
      liveModeRef.current = false;
      onExitLiveModeRef.current();
    }
  }, []);

  const commitFetch = useCallback((start: number, end: number) => {
    const window = { start: new Date(start), end: new Date(end) };
    onTimeWindowChangeRef.current(window);
    onCommitFetchWindowRef.current?.(window);
  }, []);

  /** Coalesce map previews to one update per animation frame; slider draft stays every event. */
  const pendingPreviewRef = useRef<{ start: number; end: number } | null>(null);
  const previewFrameRef = useRef<number | null>(null);
  const draftRef = useRef<{ start: number; end: number } | null>(null);

  const flushPreview = useCallback(() => {
    const pending = pendingPreviewRef.current;
    if (!pending) return;
    pendingPreviewRef.current = null;
    // Preview only — client filter; never hit the API while scrubbing.
    onTimeWindowChangeRef.current({
      start: new Date(pending.start),
      end: new Date(pending.end),
    });
  }, []);

  const cancelPreviewFrame = useCallback(() => {
    if (previewFrameRef.current != null) {
      window.cancelAnimationFrame(previewFrameRef.current);
      previewFrameRef.current = null;
    }
  }, []);

  const previewWindow = useCallback(
    (start: number, end: number) => {
      exitLiveIfNeeded();
      const next = { start, end };
      draftRef.current = next;
      setDraft(next);
      pendingPreviewRef.current = next;
      if (previewFrameRef.current == null) {
        previewFrameRef.current = window.requestAnimationFrame(() => {
          previewFrameRef.current = null;
          flushPreview();
        });
      }
    },
    [exitLiveIfNeeded, flushPreview],
  );

  const emitDraft = useCallback(
    (start: number, end: number) => {
      previewWindow(start, end);
    },
    [previewWindow],
  );

  const commitWindow = useCallback(
    (start: number, end: number) => {
      exitLiveIfNeeded();
      cancelPreviewFrame();
      pendingPreviewRef.current = null;
      draftRef.current = null;
      setDraft(null);
      commitFetch(start, end);
    },
    [cancelPreviewFrame, commitFetch, exitLiveIfNeeded],
  );

  useEffect(
    () => () => {
      cancelPreviewFrame();
      flushPreview();
    },
    [cancelPreviewFrame, flushPreview],
  );

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
      const delta = ((event.clientX - state.startX) / canvasW) * state.origViewSpan;
      if (state.zone === "bg") {
        // Panning away from Live is browsing history — leave Live once.
        exitLiveIfNeeded();
        setViewStart(state.origViewStart - delta);
        return;
      }
      if (state.zone === "left") {
        emitDraft(Math.min(state.origWS + delta, state.origWE - ONE_HOUR), state.origWE);
      } else if (state.zone === "right") {
        emitDraft(state.origWS, Math.max(state.origWE + delta, state.origWS + ONE_HOUR));
      } else {
        const start = state.origWS + delta;
        emitDraft(start, start + state.origWE - state.origWS);
      }
    };
    const up = () => {
      if (!dragState.current) return;
      const wasSelecting = dragState.current.zone !== "bg";
      dragState.current = null;
      dragZone.current = null;
      if (canvasRef.current) canvasRef.current.style.cursor = "default";
      if (wasSelecting) {
        const finalDraft = draftRef.current ?? pendingPreviewRef.current;
        cancelPreviewFrame();
        pendingPreviewRef.current = null;
        draftRef.current = null;
        setDraft(null);
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
  }, [canvasW, cancelPreviewFrame, commitFetch, emitDraft, exitLiveIfNeeded]);

  const onWheel = useCallback(
    (event: React.WheelEvent) => {
      event.preventDefault();
      exitLiveIfNeeded();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const x = event.clientX - rect.left;
      const timestamp = viewStart + (x / canvasW) * viewSpan;
      const span = clamp(
        viewSpan * (event.deltaY > 0 ? 1.2 : 1 / 1.2),
        ONE_HOUR,
        365 * ONE_DAY,
      );
      setViewSpan(span);
      setViewStart(timestamp - (x / canvasW) * span);
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
      if (!event.target.value) return;
      const [year, month, day] = event.target.value.split("-");
      const noon = new Date(Number(year), Number(month) - 1, Number(day), 12).getTime();
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
      const step = event.shiftKey ? ONE_DAY : ONE_HOUR;
      const delta: Record<string, number> = {
        ArrowLeft: -step,
        ArrowDown: -step,
        ArrowRight: step,
        ArrowUp: step,
        PageDown: -ONE_DAY,
        PageUp: ONE_DAY,
      };
      const next =
        event.key === "Home"
          ? handle === "start"
            ? sliderMin
            : wS + ONE_HOUR
          : event.key === "End"
            ? handle === "start"
              ? wE - ONE_HOUR
              : sliderMax
            : delta[event.key] == null
              ? null
              : current + delta[event.key];
      if (next == null) return;
      event.preventDefault();
      if (handle === "start") {
        commitWindow(clamp(next, sliderMin, wE - ONE_HOUR), wE);
      } else {
        commitWindow(wS, clamp(next, wS + ONE_HOUR, sliderMax));
      }
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

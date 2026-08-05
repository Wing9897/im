/**
 * Pure gesture / viewport geometry for the intelligence map timeline slider.
 * The React hook binds events; this module stays free of DOM refs.
 */

const ONE_HOUR = 60 * 60 * 1000;
const ONE_DAY = 24 * ONE_HOUR;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** Viewport span while Live — slightly wider than the ±Nh selection. */
export function liveViewportSpanMs(selectionHalfMs: number): number {
  const selection = Math.max(selectionHalfMs, ONE_HOUR) * 2;
  return Math.max(selection * 1.5, selection + 6 * ONE_HOUR);
}

/** Matches timelineSliderLayout HitZone. */
export type DragZone = "left" | "right" | "range" | "bg";

export type DragGestureState = {
  zone: DragZone;
  startX: number;
  origWS: number;
  origWE: number;
  origViewStart: number;
  /** Freeze span for the whole gesture so mid-drag rescale cannot warp delta. */
  origViewSpan: number;
};

/** Pixel delta → time delta using the gesture's frozen view span. */
export function dragDeltaMs(
  clientX: number,
  state: Pick<DragGestureState, "startX" | "origViewSpan">,
  canvasW: number,
): number {
  return ((clientX - state.startX) / canvasW) * state.origViewSpan;
}

export type DragSelectionResult =
  | { kind: "pan"; viewStart: number }
  | { kind: "select"; start: number; end: number };

/** Apply a pointer move to the frozen drag gesture. */
export function applyDragMove(
  state: DragGestureState,
  deltaMs: number,
): DragSelectionResult {
  if (state.zone === "bg") {
    return { kind: "pan", viewStart: state.origViewStart - deltaMs };
  }
  if (state.zone === "left") {
    return {
      kind: "select",
      start: Math.min(state.origWS + deltaMs, state.origWE - ONE_HOUR),
      end: state.origWE,
    };
  }
  if (state.zone === "right") {
    return {
      kind: "select",
      start: state.origWS,
      end: Math.max(state.origWE + deltaMs, state.origWS + ONE_HOUR),
    };
  }
  const start = state.origWS + deltaMs;
  return {
    kind: "select",
    start,
    end: start + state.origWE - state.origWS,
  };
}

/** Wheel zoom about a cursor x position on the canvas. */
export function wheelZoomViewport(
  viewStart: number,
  viewSpan: number,
  canvasW: number,
  cursorX: number,
  deltaY: number,
): { viewStart: number; viewSpan: number } {
  const timestamp = viewStart + (cursorX / canvasW) * viewSpan;
  const span = clamp(
    viewSpan * (deltaY > 0 ? 1.2 : 1 / 1.2),
    ONE_HOUR,
    365 * ONE_DAY,
  );
  return {
    viewSpan: span,
    viewStart: timestamp - (cursorX / canvasW) * span,
  };
}

/** Keyboard nudge for a selection handle; null when the key is ignored. */
export function handleKeyNextMs(
  handle: "start" | "end",
  key: string,
  shiftKey: boolean,
  current: number,
  wS: number,
  wE: number,
  sliderMin: number,
  sliderMax: number,
): number | null {
  const step = shiftKey ? ONE_DAY : ONE_HOUR;
  const delta: Record<string, number> = {
    ArrowLeft: -step,
    ArrowDown: -step,
    ArrowRight: step,
    ArrowUp: step,
    PageDown: -ONE_DAY,
    PageUp: ONE_DAY,
  };
  if (key === "Home") {
    return handle === "start" ? sliderMin : wS + ONE_HOUR;
  }
  if (key === "End") {
    return handle === "start" ? wE - ONE_HOUR : sliderMax;
  }
  if (delta[key] == null) return null;
  return current + delta[key];
}

/** Clamp a keyboard-moved handle into a valid [start, end] window. */
export function clampHandleCommit(
  handle: "start" | "end",
  next: number,
  wS: number,
  wE: number,
  sliderMin: number,
  sliderMax: number,
): { start: number; end: number } {
  if (handle === "start") {
    return { start: clamp(next, sliderMin, wE - ONE_HOUR), end: wE };
  }
  return { start: wS, end: clamp(next, wS + ONE_HOUR, sliderMax) };
}

/** Noon local ms from a YYYY-MM-DD date input value. */
export function calendarNoonMs(value: string): number | null {
  if (!value) return null;
  const [year, month, day] = value.split("-");
  return new Date(Number(year), Number(month) - 1, Number(day), 12).getTime();
}

/**
 * Shared Gantt time→cell geometry for board embed (% layout) and timeline
 * (CSS grid columns). Cells are 0-based with exclusive end; adapters convert
 * to 1-based CSS grid when needed.
 */

export const GANTT_DAY_MS = 24 * 60 * 60 * 1000;
export const GANTT_HOUR_MS = 60 * 60 * 1000;

export type ClippedInterval = {
  clippedStart: number;
  clippedEnd: number;
};

/** Overlap of [start, end] with [axisStart, axisEnd), or null if none. */
export function clipIntervalToAxis(
  startMs: number,
  endMs: number,
  axisStart: number,
  axisEnd: number,
): ClippedInterval | null {
  if (endMs <= axisStart || startMs >= axisEnd) {
    return null;
  }
  return {
    clippedStart: Math.max(startMs, axisStart),
    clippedEnd: Math.min(endMs, axisEnd),
  };
}

export type CellSpan = {
  /** Inclusive 0-based start cell. */
  startCell: number;
  /** Exclusive 0-based end cell (always ≥ startCell + 1 after clamp). */
  endCell: number;
};

/**
 * Clip a raw 0-based/exclusive cell span to the visible axis.
 * This is the shared render boundary used by both Timeline's CSS grid and
 * Board's percentage bars.
 */
export function clipCellSpanToAxis(
  startCell: number,
  endCell: number,
  tickCount: number,
): CellSpan | null {
  if (tickCount <= 0 || endCell <= 0 || startCell >= tickCount) {
    return null;
  }
  const clippedStart = Math.max(0, Math.min(tickCount - 1, startCell));
  const clippedEnd = Math.max(
    clippedStart + 1,
    Math.min(tickCount, Math.max(endCell, startCell + 1)),
  );
  return { startCell: clippedStart, endCell: clippedEnd };
}

/**
 * Map a clipped ms interval onto discrete axis cells.
 * Point / sub-cell spans still occupy at least one full cell.
 */
export function msRangeToCellSpan(
  clippedStart: number,
  clippedEnd: number,
  axisStart: number,
  cellMs: number,
  tickCount: number,
): CellSpan | null {
  if (cellMs <= 0 || tickCount <= 0) {
    return null;
  }

  const startCell = Math.floor((clippedStart - axisStart) / cellMs);
  const endCell = Math.ceil((clippedEnd - axisStart) / cellMs);

  return clipCellSpanToAxis(startCell, endCell, tickCount);
}

/** Percent left/width for board-style absolute bars. */
export function cellSpanToPercent(
  startCell: number,
  endCell: number,
  tickCount: number,
): { left: number; width: number } {
  return {
    left: (startCell / tickCount) * 100,
    width: ((endCell - startCell) / tickCount) * 100,
  };
}

/**
 * Board bar layout: clip → cells → %. Returns null when outside the axis.
 */
export function calculateAxisBarLayout(
  startMs: number,
  endMs: number,
  axis: { start: number; end: number; cellMs: number; tickCount: number },
): (CellSpan & { left: number; width: number }) | null {
  const duration = axis.end - axis.start;
  if (duration <= 0 || axis.tickCount <= 0 || axis.cellMs <= 0) {
    return null;
  }
  const clipped = clipIntervalToAxis(startMs, endMs, axis.start, axis.end);
  if (!clipped) {
    return null;
  }
  const span = msRangeToCellSpan(
    clipped.clippedStart,
    clipped.clippedEnd,
    axis.start,
    axis.cellMs,
    axis.tickCount,
  );
  if (!span) {
    return null;
  }
  const pct = cellSpanToPercent(span.startCell, span.endCell, axis.tickCount);
  return { ...span, ...pct };
}

/** Convert 0-based exclusive cell span to 1-based inclusive CSS grid columns. */
export function cellSpanToCssGridColumns(span: CellSpan): {
  startColumn: number;
  endColumn: number;
} {
  return {
    startColumn: span.startCell + 1,
    endColumn: span.endCell,
  };
}

/**
 * Phone-widget style size presets (cols × rows) in design-grid units.
 * Design canvas size is derived from the full 16×10 grid so frames can
 * stretch-fill the viewport (FAB overlays; no reserved side gutter).
 */

export const BOARD_GRID_COLS = 16;
export const BOARD_GRID_ROWS = 10;
const BOARD_PAD = 2;
const BOARD_GAP = 4;
/**
 * Cell size tuned so 10 rows (+ pads/gaps) fill BOARD_DESIGN_HEIGHT exactly.
 * Width then follows from 16 cols — BoardCanvas stretch-fills the viewport.
 */
const BOARD_CELL = 68;

/** Exact pixel extent of the 16×10 mosaic (no unused internal margin). */
export const BOARD_DESIGN_WIDTH =
  BOARD_PAD * 2 +
  BOARD_GRID_COLS * BOARD_CELL +
  (BOARD_GRID_COLS - 1) * BOARD_GAP;
export const BOARD_DESIGN_HEIGHT =
  BOARD_PAD * 2 +
  BOARD_GRID_ROWS * BOARD_CELL +
  (BOARD_GRID_ROWS - 1) * BOARD_GAP;

type BoardSizeId = `${number}x${number}`;

export interface BoardSizePreset {
  id: BoardSizeId;
  cols: number;
  rows: number;
  /** Short label for the size picker. */
  label: string;
}

function preset(cols: number, rows: number): BoardSizePreset {
  return {
    id: `${cols}x${rows}`,
    cols,
    rows,
    label: `${cols}×${rows}`,
  };
}

/** Shared catalog — widgets pick a subset. */
export const BOARD_SIZE_PRESETS = {
  "2x1": preset(2, 1),
  "2x2": preset(2, 2),
  "2x3": preset(2, 3),
  "3x1": preset(3, 1),
  "3x2": preset(3, 2),
  "3x3": preset(3, 3),
  "3x4": preset(3, 4),
  "3x5": preset(3, 5),
  "4x1": preset(4, 1),
  "4x2": preset(4, 2),
  "4x3": preset(4, 3),
  "4x4": preset(4, 4),
  "4x5": preset(4, 5),
  "4x6": preset(4, 6),
  "5x2": preset(5, 2),
  "5x1": preset(5, 1),
  "5x3": preset(5, 3),
  "5x4": preset(5, 4),
  "5x5": preset(5, 5),
  "6x1": preset(6, 1),
  "6x2": preset(6, 2),
  "6x3": preset(6, 3),
  "6x4": preset(6, 4),
  "6x5": preset(6, 5),
  "6x6": preset(6, 6),
  "8x1": preset(8, 1),
  "8x2": preset(8, 2),
  "8x3": preset(8, 3),
  "8x4": preset(8, 4),
  "8x5": preset(8, 5),
  "8x6": preset(8, 6),
  "9x6": preset(9, 6),
  "10x2": preset(10, 2),
  "12x2": preset(12, 2),
  "16x1": preset(16, 1),
  "16x2": preset(16, 2),
} as const satisfies Record<string, BoardSizePreset>;

export type BoardSizePresetId = keyof typeof BOARD_SIZE_PRESETS;

export function sizePresetPixels(preset: BoardSizePreset): { w: number; h: number } {
  return {
    w: preset.cols * BOARD_CELL + Math.max(0, preset.cols - 1) * BOARD_GAP,
    h: preset.rows * BOARD_CELL + Math.max(0, preset.rows - 1) * BOARD_GAP,
  };
}

export function gridToPixels(col: number, row: number): { x: number; y: number } {
  return {
    x: BOARD_PAD + col * (BOARD_CELL + BOARD_GAP),
    y: BOARD_PAD + row * (BOARD_CELL + BOARD_GAP),
  };
}

export function pixelsToGrid(x: number, y: number): { col: number; row: number } {
  const step = BOARD_CELL + BOARD_GAP;
  return {
    col: Math.max(0, Math.round((x - BOARD_PAD) / step)),
    row: Math.max(0, Math.round((y - BOARD_PAD) / step)),
  };
}

export function resolveSizePreset(
  sizeId: string | undefined,
  allowed: readonly BoardSizePresetId[],
  fallback: BoardSizePresetId,
): BoardSizePreset {
  const id = (allowed.includes(sizeId as BoardSizePresetId)
    ? sizeId
    : fallback) as BoardSizePresetId;
  return BOARD_SIZE_PRESETS[id];
}

/**
 * Map a stored / requested size onto an allowed preset.
 * Prefer keeping the same column count and growing rows when the old size
 * is no longer allowed (e.g. a crushed 3×2 schedule → 3×3).
 */
export function pickAllowedSizePreset(
  sizeId: string | undefined,
  allowed: readonly BoardSizePresetId[],
  fallback: BoardSizePresetId,
): BoardSizePreset {
  if (sizeId && allowed.includes(sizeId as BoardSizePresetId)) {
    return BOARD_SIZE_PRESETS[sizeId as BoardSizePresetId];
  }
  const parsed = typeof sizeId === "string" ? /^(\d+)x(\d+)$/.exec(sizeId) : null;
  if (parsed && allowed.length > 0) {
    const cols = Number(parsed[1]);
    const rows = Number(parsed[2]);
    const presets = allowed.map((id) => BOARD_SIZE_PRESETS[id]);
    const growSameCols = presets
      .filter((preset) => preset.cols === cols && preset.rows >= rows)
      .sort((a, b) => a.rows - b.rows);
    if (growSameCols[0]) {
      return growSameCols[0];
    }
    const sameCols = presets
      .filter((preset) => preset.cols === cols)
      .sort((a, b) => a.rows - b.rows);
    if (sameCols[0]) {
      return sameCols[0];
    }
  }
  return resolveSizePreset(sizeId, allowed, fallback);
}

/** Keep a widget origin inside the 16×10 design grid for its size. */
export function clampGridOrigin(
  col: number,
  row: number,
  cols: number,
  rows: number,
): { col: number; row: number } {
  return {
    col: Math.max(0, Math.min(col, Math.max(0, BOARD_GRID_COLS - cols))),
    row: Math.max(0, Math.min(row, Math.max(0, BOARD_GRID_ROWS - rows))),
  };
}

/** Axis-aligned overlap test in design pixels (for layout invariants). */
export function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

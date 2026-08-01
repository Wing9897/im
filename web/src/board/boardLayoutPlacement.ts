import type { BoardWidgetItem, BoardWidgetType } from "./types";
import {
  BOARD_GRID_COLS,
  BOARD_GRID_ROWS,
  gridToPixels,
  resolveSizePreset,
  sizePresetPixels,
  type BoardSizePresetId,
} from "./boardSizePresets";
import { getWidgetDefaultSizeId, getWidgetSizeOptions } from "./widgetRegistry";

export function widgetDesignRect(widget: BoardWidgetItem): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  const preset = resolveSizePreset(
    widget.sizeId,
    getWidgetSizeOptions(widget.type),
    getWidgetDefaultSizeId(widget.type),
  );
  const { w, h } = sizePresetPixels(preset);
  const { x, y } = gridToPixels(widget.col, widget.row);
  return { x, y, w, h };
}

/** Grid AABB for overlap tests (col/row units, not design pixels). */
function widgetGridRect(widget: BoardWidgetItem): {
  col: number;
  row: number;
  cols: number;
  rows: number;
} {
  const preset = resolveSizePreset(
    widget.sizeId,
    getWidgetSizeOptions(widget.type),
    getWidgetDefaultSizeId(widget.type),
  );
  return {
    col: widget.col,
    row: widget.row,
    cols: preset.cols,
    rows: preset.rows,
  };
}

function gridRectsOverlap(
  a: { col: number; row: number; cols: number; rows: number },
  b: { col: number; row: number; cols: number; rows: number },
): boolean {
  return (
    a.col < b.col + b.cols &&
    a.col + a.cols > b.col &&
    a.row < b.row + b.rows &&
    a.row + a.rows > b.row
  );
}

/**
 * Place a new frame inside the 16×10 design grid.
 * Prefer a non-overlapping cell; if the mosaic is full, cascade with a 1-cell
 * offset from an existing same-type (or origin) so the frame stays on-canvas
 * and visible above others (caller assigns a higher z).
 *
 * Legacy `row: maxRow` spilled below the stretch-filled surface (overflow:hidden)
 * and looked like「新增組件」did nothing.
 */
export function findFreePlacement(
  widgets: BoardWidgetItem[],
  type: BoardWidgetType,
  sizeId: BoardSizePresetId = getWidgetDefaultSizeId(type),
): { col: number; row: number } {
  const preset = resolveSizePreset(
    sizeId,
    getWidgetSizeOptions(type),
    getWidgetDefaultSizeId(type),
  );
  const cols = preset.cols;
  const rows = preset.rows;
  const maxCol = Math.max(0, BOARD_GRID_COLS - cols);
  const maxRow = Math.max(0, BOARD_GRID_ROWS - rows);
  const occupied = widgets.map(widgetGridRect);

  for (let row = 0; row <= maxRow; row++) {
    for (let col = 0; col <= maxCol; col++) {
      const candidate = { col, row, cols, rows };
      if (!occupied.some((other) => gridRectsOverlap(candidate, other))) {
        return { col, row };
      }
    }
  }

  // Dense mosaic: keep on-canvas and peek past an existing instance.
  const sameType = widgets.filter((w) => w.type === type);
  const anchor = sameType[0] ?? widgets[0];
  const offset = Math.max(1, sameType.length);
  return {
    col: Math.min(maxCol, (anchor?.col ?? 0) + offset),
    row: Math.min(maxRow, (anchor?.row ?? 0) + offset),
  };
}

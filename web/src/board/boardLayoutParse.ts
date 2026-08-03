import {
  BOARD_LAYOUT_VERSION,
  type BoardConfig,
  type BoardWidgetItem,
  type BoardWidgetType,
} from "./types";
import {
  resolveSizePreset,
  type BoardSizePresetId,
} from "./boardSizePresets";
import {
  BOARD_WIDGET_TYPES,
  getWidgetDefaultSizeId,
  getWidgetSizeOptions,
} from "./widgetRegistry";

/** Minimum widgets for a filled world-monitor mosaic (below → treat as sparse). */
const MIN_MOSAIC_WIDGETS = 6;

export function createDefaultBoardConfig(): BoardConfig {
  // Dense non-overlapping mosaic (16×10) v15 (same layout as v14):
  //  top: full-width dual gantt; left: clock/system/actions/leaderboard/logs
  //  right: month calendar + day schedule (locked); mid/bottom: map/wall/weather/…
  return {
    version: BOARD_LAYOUT_VERSION,
    widgets: [
      { i: "w-gantt", type: "gantt", col: 0, row: 0, sizeId: "16x1", z: 1 },
      { i: "w-gantt-events", type: "gantt-events", col: 0, row: 1, sizeId: "16x1", z: 2 },
      { i: "w-clock", type: "clock", col: 0, row: 2, sizeId: "3x1", z: 3 },
      { i: "w-system", type: "system", col: 0, row: 3, sizeId: "3x1", z: 4 },
      { i: "w-actions", type: "actions", col: 0, row: 4, sizeId: "3x2", z: 5 },
      { i: "w-leaderboard", type: "leaderboard", col: 0, row: 6, sizeId: "3x2", z: 6 },
      { i: "w-logs", type: "logs", col: 0, row: 8, sizeId: "3x2", z: 7 },
      { i: "w-map", type: "map", col: 3, row: 2, sizeId: "5x3", z: 8 },
      { i: "w-wall", type: "wall", col: 8, row: 2, sizeId: "3x3", z: 9 },
      { i: "w-calendar", type: "calendar", col: 11, row: 2, sizeId: "5x3", z: 10 },
      { i: "w-calendar-day", type: "calendar-day", col: 11, row: 5, sizeId: "5x1", z: 11 },
      { i: "w-weather", type: "weather", col: 3, row: 5, sizeId: "5x2", z: 12 },
      { i: "w-tasks", type: "tasks", col: 8, row: 5, sizeId: "3x2", z: 13 },
      { i: "w-stats", type: "stats", col: 11, row: 6, sizeId: "5x2", z: 14 },
      { i: "w-events", type: "events", col: 3, row: 7, sizeId: "4x3", z: 15 },
      { i: "w-feed", type: "feed", col: 7, row: 7, sizeId: "4x3", z: 16 },
      { i: "w-queue", type: "queue", col: 11, row: 8, sizeId: "3x2", z: 17 },
      { i: "w-sources", type: "sources", col: 14, row: 8, sizeId: "2x2", z: 18 },
    ],
  };
}

/** True when the cache looks like a partial / broken mosaic (not a filled monitor). */
export function isSparseLayout(widgets: BoardWidgetItem[]): boolean {
  if (widgets.length < MIN_MOSAIC_WIDGETS) {
    return true;
  }
  const types = new Set(widgets.map((w) => w.type));
  // A lone map (or map+one) is the common broken cache from partial edits.
  return types.size <= 2 && types.has("map");
}

function isWidgetType(value: unknown): value is BoardWidgetType {
  return typeof value === "string" && (BOARD_WIDGET_TYPES as readonly string[]).includes(value);
}

/** Normalize one widget in the current grid/preset schema. */
export function normalizeLayoutWidget(raw: unknown, index: number): BoardWidgetItem | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const item = raw as Record<string, unknown>;
  if (!isWidgetType(item.type)) {
    return null;
  }
  const i =
    typeof item.i === "string" && item.i.length > 0 ? item.i : `widget-${index}-${item.type}`;
  const options = getWidgetSizeOptions(item.type);
  const fallback = getWidgetDefaultSizeId(item.type);
  const sizeId = resolveSizePreset(
    typeof item.sizeId === "string" ? item.sizeId : undefined,
    options,
    fallback,
  ).id as BoardSizePresetId;

  const num = (key: string, fallbackNum: number) =>
    typeof item[key] === "number" && Number.isFinite(item[key])
      ? Math.max(0, Math.floor(item[key]))
      : fallbackNum;

  return {
    i,
    type: item.type,
    col: num("col", 0),
    row: num("row", 0),
    sizeId,
    z: typeof item.z === "number" ? item.z : index + 1,
  };
}

/**
 * Parse a board layout. Unknown/older versions and sparse caches reset to the
 * default mosaic; there are no incremental mid-version upgrades.
 */
export function parseBoardConfig(raw: unknown): BoardConfig {
  const fallback = createDefaultBoardConfig();
  if (!raw || typeof raw !== "object") {
    return fallback;
  }
  const data = raw as Record<string, unknown>;
  const version = typeof data.version === "number" ? data.version : 1;
  const widgetsRaw = Array.isArray(data.widgets) ? data.widgets : null;
  if (!widgetsRaw) {
    return fallback;
  }
  const widgets = widgetsRaw
    .map((item, index) => normalizeLayoutWidget(item, index))
    .filter((item): item is BoardWidgetItem => item !== null);

  // Layout version bump (no mid-version incremental upgrades), or a sparse
  // cache that only kept a couple frames → filled default mosaic.
  if (widgets.length === 0 || version < BOARD_LAYOUT_VERSION || isSparseLayout(widgets)) {
    return fallback;
  }

  return {
    version: BOARD_LAYOUT_VERSION,
    widgets,
  };
}

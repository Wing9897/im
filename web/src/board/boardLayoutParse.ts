import {
  BOARD_LAYOUT_VERSION,
  type BoardConfig,
  type BoardWidgetItem,
  type BoardWidgetType,
} from "./types";
import {
  BOARD_SIZE_PRESETS,
  clampGridOrigin,
  pickAllowedSizePreset,
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
  // Dense non-overlapping mosaic (16×10) v17:
  //  left column gives 我的日程 3×3 (readable title+time rows);
  //  日程 (calendar-day) is 5×2 instead of a 1-row sliver.
  return {
    version: BOARD_LAYOUT_VERSION,
    widgets: [
      { i: "w-gantt", type: "gantt", col: 0, row: 0, sizeId: "16x1", z: 1 },
      { i: "w-gantt-events", type: "gantt-events", col: 0, row: 1, sizeId: "16x1", z: 2 },
      { i: "w-clock", type: "clock", col: 0, row: 2, sizeId: "3x1", z: 3 },
      { i: "w-system", type: "system", col: 0, row: 3, sizeId: "3x1", z: 4 },
      { i: "w-actions", type: "actions", col: 0, row: 4, sizeId: "3x2", z: 5 },
      { i: "w-leaderboard", type: "leaderboard", col: 0, row: 6, sizeId: "3x1", z: 6 },
      { i: "w-schedule", type: "schedule", col: 0, row: 7, sizeId: "3x3", z: 7 },
      { i: "w-map", type: "map", col: 3, row: 2, sizeId: "5x3", z: 8 },
      { i: "w-wall", type: "wall", col: 8, row: 2, sizeId: "3x3", z: 9 },
      { i: "w-calendar", type: "calendar", col: 11, row: 2, sizeId: "5x2", z: 10 },
      { i: "w-calendar-day", type: "calendar-day", col: 11, row: 4, sizeId: "5x2", z: 11 },
      { i: "w-weather", type: "weather", col: 3, row: 5, sizeId: "5x2", z: 12 },
      { i: "w-tasks", type: "tasks", col: 8, row: 5, sizeId: "3x2", z: 13 },
      { i: "w-stats", type: "stats", col: 11, row: 6, sizeId: "5x2", z: 14 },
      { i: "w-events", type: "events", col: 3, row: 7, sizeId: "4x3", z: 15 },
      { i: "w-feed", type: "feed", col: 7, row: 7, sizeId: "4x3", z: 16 },
      { i: "w-items", type: "items", col: 11, row: 8, sizeId: "3x2", z: 17 },
      { i: "w-llm-health", type: "llm-health", col: 14, row: 8, sizeId: "2x2", z: 18 },
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

function isPresetId(value: string | undefined): value is BoardSizePresetId {
  return Boolean(value && value in BOARD_SIZE_PRESETS);
}

function readFiniteInt(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.floor(value))
    : fallback;
}

/**
 * Parse one widget without clamping to the type's min size.
 * Stored 3×2 schedule tiles must stay 3×2 long enough for v16 mosaic lift.
 */
export function readLayoutWidget(raw: unknown, index: number): BoardWidgetItem | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const item = raw as Record<string, unknown>;
  if (!isWidgetType(item.type)) {
    return null;
  }
  const i =
    typeof item.i === "string" && item.i.length > 0 ? item.i : `widget-${index}-${item.type}`;
  const rawSize = typeof item.sizeId === "string" ? item.sizeId : undefined;
  const fallback = getWidgetDefaultSizeId(item.type);
  const sizeId = isPresetId(rawSize) ? rawSize : fallback;

  return {
    i,
    type: item.type,
    col: readFiniteInt(item.col, 0),
    row: readFiniteInt(item.row, 0),
    sizeId,
    z: typeof item.z === "number" ? item.z : index + 1,
  };
}

/** Clamp a widget onto an allowed preset and keep it inside the 16×10 grid. */
export function clampLayoutWidget(widget: BoardWidgetItem): BoardWidgetItem {
  const options = getWidgetSizeOptions(widget.type);
  const fallback = getWidgetDefaultSizeId(widget.type);
  const preset = pickAllowedSizePreset(widget.sizeId, options, fallback);
  const origin = clampGridOrigin(widget.col, widget.row, preset.cols, preset.rows);
  return {
    ...widget,
    col: origin.col,
    row: origin.row,
    sizeId: preset.id as BoardSizePresetId,
  };
}

/**
 * v16 default mosaic pinned 我的日程 at 3×2 and 日程 at 5×1.
 * Grow those tiles in place and shrink the neighbor that occupied the extra row.
 */
export function liftCrushedDefaultMosaic(widgets: BoardWidgetItem[]): BoardWidgetItem[] {
  const schedule = widgets.find(
    (widget) =>
      widget.type === "schedule" &&
      widget.col === 0 &&
      widget.row === 8 &&
      widget.sizeId === "3x2",
  );
  const leaderboard = widgets.find(
    (widget) =>
      widget.type === "leaderboard" &&
      widget.col === 0 &&
      widget.row === 6 &&
      widget.sizeId === "3x2",
  );
  const month = widgets.find(
    (widget) =>
      widget.type === "calendar" &&
      widget.col === 11 &&
      widget.row === 2 &&
      widget.sizeId === "5x3",
  );
  const day = widgets.find(
    (widget) =>
      widget.type === "calendar-day" &&
      widget.col === 11 &&
      widget.row === 5 &&
      widget.sizeId === "5x1",
  );

  if (!schedule && !day) {
    return widgets;
  }

  return widgets.map((widget) => {
    if (schedule && leaderboard && widget === leaderboard) {
      return { ...widget, sizeId: "3x1" };
    }
    if (schedule && widget === schedule) {
      return { ...widget, sizeId: "3x3", row: 7 };
    }
    if (month && day && widget === month) {
      return { ...widget, sizeId: "5x2" };
    }
    if (day && widget === day) {
      return { ...widget, sizeId: "5x2", row: month ? 4 : widget.row };
    }
    return widget;
  });
}

/** Normalize one widget in the current grid/preset schema. */
export function normalizeLayoutWidget(raw: unknown, index: number): BoardWidgetItem | null {
  const read = readLayoutWidget(raw, index);
  return read ? clampLayoutWidget(read) : null;
}

/**
 * Migrate a widget list onto the current layout schema version.
 * Keeps recognized widgets across version bumps; only falls back to the default
 * mosaic when the layout is empty or sparse/corrupt after cleanup.
 * Incoming widgets may still carry pre-min-size presets (e.g. schedule 3×2).
 */
export function migrateBoardLayout(widgets: BoardWidgetItem[]): BoardConfig {
  if (widgets.length === 0 || isSparseLayout(widgets)) {
    return createDefaultBoardConfig();
  }
  const lifted = liftCrushedDefaultMosaic(widgets);
  return {
    version: BOARD_LAYOUT_VERSION,
    widgets: lifted.map((widget) => clampLayoutWidget(widget)),
  };
}

/**
 * Parse a board layout. Unknown/retired widget types are dropped; older
 * versions migrate in place (version bumped). Empty or sparse/corrupt caches
 * fall back to the default mosaic.
 */
export function parseBoardConfig(raw: unknown): BoardConfig {
  const fallback = createDefaultBoardConfig();
  if (!raw || typeof raw !== "object") {
    return fallback;
  }
  const data = raw as Record<string, unknown>;
  const widgetsRaw = Array.isArray(data.widgets) ? data.widgets : null;
  if (!widgetsRaw) {
    return fallback;
  }
  const widgets = widgetsRaw
    .map((item, index) => readLayoutWidget(item, index))
    .filter((item): item is BoardWidgetItem => item !== null);

  return migrateBoardLayout(widgets);
}

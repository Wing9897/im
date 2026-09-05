import i18n from "../i18n";
import {
  BOARD_LAYOUT_VERSION,
  type BoardConfig,
  type BoardWidgetItem,
  type BoardWidgetType,
} from "./types";
import {
  pickAllowedSizePreset,
  type BoardSizePresetId,
} from "./boardSizePresets";
import { getWidgetDefaultSizeId, getWidgetSizeOptions } from "./widgetRegistry";
import {
  createDefaultBoardConfig,
  migrateBoardLayout,
  readLayoutWidget,
} from "./boardLayoutParse";
import { findFreePlacement } from "./boardLayoutPlacement";
import {
  loadBoardConfigFromCache,
  saveBoardLayoutToApi,
} from "./boardPrefsStore";

export { createDefaultBoardConfig, parseBoardConfig } from "./boardLayoutParse";
export { findFreePlacement, widgetDesignRect } from "./boardLayoutPlacement";
export { hydrateBoardPrefs } from "./boardPrefsStore";

/**
 * Sync read of the hydrated layout cache (default mosaic if not yet hydrated).
 * Prefer `hydrateBoardPrefs()` on BoardRoot mount.
 */
export function loadBoardConfig(): BoardConfig {
  return loadBoardConfigFromCache();
}

/** Persist layout to memory + `/api/v1/ui-prefs/board` (widgetState unchanged). */
export function saveBoardConfig(config: BoardConfig): void {
  saveBoardLayoutToApi(config);
}

/** Serialize a portable, current-version board layout. */
export function exportBoardConfig(config: BoardConfig): string {
  return JSON.stringify(
    {
      version: BOARD_LAYOUT_VERSION,
      widgets: config.widgets,
    },
    null,
    2,
  );
}

/**
 * Validate and normalize a pasted/imported layout without silently accepting
 * malformed input. Successful imports are immediately made the local source
 * of truth, just like a drag or resize.
 */
export function importBoardConfig(json: string): BoardConfig {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error(String(i18n.t("board:shell.importInvalidJson")));
  }
  if (
    !raw ||
    typeof raw !== "object" ||
    !Array.isArray((raw as { widgets?: unknown }).widgets)
  ) {
    throw new Error(String(i18n.t("board:shell.importMissingWidgets")));
  }
  const rawWidgets = (raw as { widgets: unknown[] }).widgets;
  if (rawWidgets.length === 0) {
    throw new Error(String(i18n.t("board:shell.importNeedOne")));
  }
  const read = rawWidgets
    .map((item, index) => readLayoutWidget(item, index))
    .filter((item): item is BoardWidgetItem => item !== null);
  if (read.length === 0) {
    throw new Error(String(i18n.t("board:shell.importNoValid")));
  }
  // Soft-migrate the already-parsed list (lift crushed defaults, then min-size clamp).
  const config = migrateBoardLayout(read);
  saveBoardConfig(config);
  return config;
}

export function resetBoardConfig(): BoardConfig {
  const base = createDefaultBoardConfig();
  // Fresh instance ids so React/react-rnd cannot reuse stale drag geometry
  // from a previous sparse layout (same stable ids like "w-map" caused "reset
  // still looks like only the map" when controlled position updates were ignored).
  const stamp = Date.now().toString(36);
  const config: BoardConfig = {
    version: BOARD_LAYOUT_VERSION,
    widgets: base.widgets.map((widget) => ({
      ...widget,
      i: `${widget.i}-${stamp}`,
    })),
  };
  saveBoardConfig(config);
  return config;
}

function newWidgetInstanceId(type: BoardWidgetType): string {
  return `w-${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function nextZ(widgets: BoardWidgetItem[]): number {
  return widgets.reduce((acc, w) => Math.max(acc, w.z ?? 0), 0) + 1;
}

export function addWidget(
  config: BoardConfig,
  type: BoardWidgetType,
): BoardConfig {
  const sizeId = getWidgetDefaultSizeId(type);
  const placement = findFreePlacement(config.widgets, type, sizeId);
  const widget: BoardWidgetItem = {
    i: newWidgetInstanceId(type),
    type,
    col: placement.col,
    row: placement.row,
    sizeId,
    z: nextZ(config.widgets),
  };
  const next = { ...config, widgets: [...config.widgets, widget] };
  saveBoardConfig(next);
  return next;
}

export function removeWidget(
  config: BoardConfig,
  widgetId: string,
): BoardConfig {
  const next = {
    ...config,
    widgets: config.widgets.filter((w) => w.i !== widgetId),
  };
  saveBoardConfig(next);
  return next;
}

export function updateWidgetPlacement(
  config: BoardConfig,
  widgetId: string,
  placement: { col: number; row: number },
): BoardConfig {
  const next = {
    ...config,
    widgets: config.widgets.map((widget) =>
      widget.i === widgetId
        ? {
            ...widget,
            col: Math.max(0, Math.round(placement.col)),
            row: Math.max(0, Math.round(placement.row)),
          }
        : widget,
    ),
  };
  saveBoardConfig(next);
  return next;
}

export function updateWidgetSizeId(
  config: BoardConfig,
  widgetId: string,
  sizeId: BoardSizePresetId,
): BoardConfig {
  const next = {
    ...config,
    widgets: config.widgets.map((widget) => {
      if (widget.i !== widgetId) {
        return widget;
      }
      const options = getWidgetSizeOptions(widget.type);
      const resolved = pickAllowedSizePreset(
        sizeId,
        options,
        getWidgetDefaultSizeId(widget.type),
      );
      return { ...widget, sizeId: resolved.id as BoardSizePresetId };
    }),
  };
  saveBoardConfig(next);
  return next;
}

export function bringWidgetToFront(
  config: BoardConfig,
  widgetId: string,
): BoardConfig {
  const z = nextZ(config.widgets);
  const next = {
    ...config,
    widgets: config.widgets.map((widget) =>
      widget.i === widgetId ? { ...widget, z } : widget,
    ),
  };
  saveBoardConfig(next);
  return next;
}

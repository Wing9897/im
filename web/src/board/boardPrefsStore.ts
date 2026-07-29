/**
 * In-memory board prefs (layout + mapViews + taskFilters) backed by
 * `/api/v1/ui-prefs/board`. Server is SoT; empty server seeds defaults (no LS bridge).
 *
 * INVARIANTS:
 * - Server is SoT after hydrate; dual-write forever or LS-only saves desync devices.
 * - Device chrome keys (`im:monitor-mode`, `im:pages-last-path`) stay local —
 *   never fold into this store / ui-prefs.
 * - MapBoardEmbed must re-read prefs cache on remount (do not cache one-shot
 *   `initialView` in a parent across maximize / pages↔canvas).
 * Regression fences: `boardPrefsStore.test.ts`, board gantt/map persist tests.
 */

import {
  fetchBoardPrefs,
  putBoardPrefs,
  type BoardGanttViewMode,
  type BoardMapViewPref,
  type BoardWidgetStatePref,
} from "../api/uiPrefs";
import type { BoardConfig } from "./types";
import { createDefaultBoardConfig, parseBoardConfig } from "./boardLayoutParse";

const EMPTY_WIDGET_STATE: BoardWidgetStatePref = {
  mapViews: {},
  taskFilters: {},
  ganttViewModes: {},
};

const VALID_GANTT_VIEW_MODES = new Set<BoardGanttViewMode>(["day", "month"]);

let layoutCache: BoardConfig | null = null;
let widgetStateCache: BoardWidgetStatePref = emptyWidgetState();
let hydratePromise: Promise<BoardConfig> | null = null;

function emptyWidgetState(): BoardWidgetStatePref {
  return { mapViews: {}, taskFilters: {}, ganttViewModes: {} };
}

function cloneWidgetState(state: BoardWidgetStatePref): BoardWidgetStatePref {
  return {
    mapViews: { ...state.mapViews },
    taskFilters: { ...state.taskFilters },
    ganttViewModes: { ...state.ganttViewModes },
  };
}

/** Test helper — wipe memory so each case starts clean. */
export function resetBoardPrefsCacheForTests(): void {
  layoutCache = null;
  widgetStateCache = emptyWidgetState();
  hydratePromise = null;
}

export function getCachedBoardLayout(): BoardConfig | null {
  return layoutCache;
}

export function getCachedWidgetState(): BoardWidgetStatePref {
  return cloneWidgetState(widgetStateCache);
}

function normalizeWidgetState(raw: BoardWidgetStatePref | null | undefined): BoardWidgetStatePref {
  if (!raw || typeof raw !== "object") {
    return emptyWidgetState();
  }
  const mapViews: Record<string, BoardMapViewPref> = {};
  const taskFilters: Record<string, string[] | null> = {};
  const ganttViewModes: Record<string, BoardGanttViewMode> = {};
  const viewsIn = raw.mapViews ?? {};
  for (const [id, view] of Object.entries(viewsIn)) {
    if (!id || !view) continue;
    const center = view.center;
    if (
      !Array.isArray(center) ||
      center.length !== 2 ||
      typeof center[0] !== "number" ||
      typeof center[1] !== "number" ||
      typeof view.zoom !== "number" ||
      !Number.isFinite(view.zoom)
    ) {
      continue;
    }
    mapViews[id] = { center: [center[0], center[1]], zoom: view.zoom };
  }
  const filtersIn = raw.taskFilters ?? {};
  for (const [id, ids] of Object.entries(filtersIn)) {
    if (!id) continue;
    if (ids === null) {
      taskFilters[id] = null;
      continue;
    }
    if (!Array.isArray(ids)) continue;
    taskFilters[id] = ids.filter((x): x is string => typeof x === "string" && x.length > 0);
  }
  const modesIn = raw.ganttViewModes ?? {};
  for (const [id, mode] of Object.entries(modesIn)) {
    if (!id || typeof mode !== "string") continue;
    if (VALID_GANTT_VIEW_MODES.has(mode)) {
      ganttViewModes[id] = mode;
    }
  }
  return { mapViews, taskFilters, ganttViewModes };
}

function applyCaches(layout: BoardConfig, widgetState: BoardWidgetStatePref): BoardConfig {
  layoutCache = layout;
  widgetStateCache = cloneWidgetState(widgetState);
  return layout;
}

async function persistToApi(body: {
  layout?: BoardConfig | null;
  widgetState?: BoardWidgetStatePref | null;
}): Promise<void> {
  const payload: {
    layout?: BoardConfig | null;
    widgetState?: BoardWidgetStatePref | null;
  } = {};
  if (body.layout !== undefined) payload.layout = body.layout;
  if (body.widgetState !== undefined) payload.widgetState = body.widgetState;
  await putBoardPrefs(payload);
}

function schedulePersist(body: {
  layout?: BoardConfig | null;
  widgetState?: BoardWidgetStatePref | null;
}): void {
  void persistToApi(body).catch(() => {
    // Keep memory as source of truth; next hydrate/save can retry.
  });
}

/**
 * Load board prefs from API; when `configured: false`, seed defaults and PUT.
 * Does not read legacy localStorage (hard-cut — server SoT only).
 */
export async function hydrateBoardPrefs(): Promise<BoardConfig> {
  if (hydratePromise) {
    return hydratePromise;
  }
  hydratePromise = (async () => {
    try {
      const remote = await fetchBoardPrefs();
      if (remote.configured) {
        const layout = remote.layout
          ? parseBoardConfig(remote.layout)
          : createDefaultBoardConfig();
        const widgetState = normalizeWidgetState(remote.widgetState);
        return applyCaches(layout, widgetState);
      }

      const layout = createDefaultBoardConfig();
      const widgetState = emptyWidgetState();
      try {
        await putBoardPrefs({ layout, widgetState });
      } catch {
        // Offline / 422: still serve memory defaults.
      }
      return applyCaches(layout, widgetState);
    } catch {
      // GET failed — serve defaults (no localStorage bridge).
      return applyCaches(createDefaultBoardConfig(), emptyWidgetState());
    }
  })();

  return hydratePromise;
}

/** Sync read after hydrate (or default mosaic before hydrate). Does not touch LS. */
export function loadBoardConfigFromCache(): BoardConfig {
  if (layoutCache) return layoutCache;
  return createDefaultBoardConfig();
}

/** Update layout memory + PUT layout (widgetState unchanged on server). */
export function saveBoardLayoutToApi(config: BoardConfig): void {
  layoutCache = config;
  schedulePersist({ layout: config });
}

export function loadBoardMapViewFromCache(widgetId: string): BoardMapViewPref | null {
  if (!widgetId) return null;
  return widgetStateCache.mapViews[widgetId] ?? null;
}

export function saveBoardMapViewToApi(widgetId: string, view: BoardMapViewPref): void {
  if (!widgetId) return;
  widgetStateCache = {
    ...widgetStateCache,
    mapViews: { ...widgetStateCache.mapViews, [widgetId]: view },
  };
  schedulePersist({ widgetState: cloneWidgetState(widgetStateCache) });
}

export function clearBoardMapViewInApi(widgetId: string): void {
  if (!widgetId) return;
  const { [widgetId]: _, ...rest } = widgetStateCache.mapViews;
  void _;
  widgetStateCache = { ...widgetStateCache, mapViews: rest };
  schedulePersist({ widgetState: cloneWidgetState(widgetStateCache) });
}

export function loadTaskFilterIdsFromCache(widgetId: string | undefined): string[] | null {
  if (!widgetId) return null;
  if (!(widgetId in widgetStateCache.taskFilters)) return null;
  return widgetStateCache.taskFilters[widgetId] ?? null;
}

export function saveTaskFilterIdsToApi(widgetId: string | undefined, ids: string[] | null): void {
  if (!widgetId) return;
  widgetStateCache = {
    ...widgetStateCache,
    taskFilters: { ...widgetStateCache.taskFilters, [widgetId]: ids },
  };
  schedulePersist({ widgetState: cloneWidgetState(widgetStateCache) });
}

export function loadBoardGanttViewModeFromCache(
  widgetId: string | undefined,
): BoardGanttViewMode | null {
  if (!widgetId) return null;
  const mode = widgetStateCache.ganttViewModes[widgetId];
  return mode && VALID_GANTT_VIEW_MODES.has(mode) ? mode : null;
}

export function saveBoardGanttViewModeToApi(
  widgetId: string | undefined,
  mode: BoardGanttViewMode,
): void {
  if (!widgetId || !VALID_GANTT_VIEW_MODES.has(mode)) return;
  widgetStateCache = {
    ...widgetStateCache,
    ganttViewModes: { ...widgetStateCache.ganttViewModes, [widgetId]: mode },
  };
  schedulePersist({ widgetState: cloneWidgetState(widgetStateCache) });
}

/** Seed caches without network (unit tests for sync mutators). */
export function seedBoardPrefsCacheForTests(
  layout: BoardConfig,
  widgetState: BoardWidgetStatePref = EMPTY_WIDGET_STATE,
): void {
  layoutCache = layout;
  widgetStateCache = cloneWidgetState(widgetState);
  hydratePromise = Promise.resolve(layout);
}

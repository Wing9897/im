import type { TFunction } from "i18next";
import type { AnalysisEvent, TimeWindow } from "../../types";
import i18n from "../../i18n";

/**
 * Single source of feed sizes / map soft-cap. List `INTELLIGENCE_PAGE_SIZE`
 * and map `MAP_SYNC_*` are different on purpose — do not collapse them.
 */

/** API page size — must match server cap in results.py (max 200). */
export const INTELLIGENCE_API_PAGE_SIZE = 200;

/** Card/list visible batch before revealing more cached rows or fetching next API page. */
export const INTELLIGENCE_PAGE_SIZE = 50;

/**
 * Map auto-fill soft cap (pages × API size). Not a list infinite-scroll limit.
 * Users can explicitly load more past this via「載入下一批」(`MAP_SYNC_LOAD_MORE_PAGES`).
 */
export const MAP_SYNC_MAX_TOTAL_PAGES = 5;

/** Pages fetched per explicit map「載入下一批」click (beyond the soft auto-cap). */
export const MAP_SYNC_LOAD_MORE_PAGES = 1;

/** Retries per page when appendRemotePage contends or fails transiently. */
export const MAP_SYNC_PAGE_RETRIES = 2;

export const MAP_SYNC_MAX_ITEMS =
  MAP_SYNC_MAX_TOTAL_PAGES * INTELLIGENCE_API_PAGE_SIZE;

type Translate = TFunction | typeof i18n.t;

function intelligenceT(
  key: string,
  t?: Translate,
): string {
  if (t) return String(t(key));
  return String(i18n.t(`intelligence:${key}`));
}

/** Shown when map sync stops because of the page/item cap (not silent truncate). */
export function getMapSyncCapHint(t?: Translate): string {
  return intelligenceT("map.syncCapHint", t);
}

export function isMapSyncAtItemCap(itemCount: number): boolean {
  return itemCount >= MAP_SYNC_MAX_ITEMS;
}

export type IntelligenceApiDateRange = {
  startDate: string;
  endDate: string;
};

/** Server-side event list ordering (`GET /results/events?sort=`). */
export type IntelligenceSortMode = "event_time" | "analyzed_at";

export const INTELLIGENCE_SORT_MODES: readonly IntelligenceSortMode[] = [
  "event_time",
  "analyzed_at",
];

export function getIntelligenceSortLabel(
  mode: IntelligenceSortMode,
  t?: Translate,
): string {
  return intelligenceT(`sort.${mode}`, t);
}

/** Convert a UI time window to API camelCase date params (ISO 8601). */
export function timeWindowToApiParams(window: TimeWindow): IntelligenceApiDateRange {
  return {
    startDate: window.start.toISOString(),
    endDate: window.end.toISOString(),
  };
}

export function getLoadMoreHint(
  params: {
    loadingMore: boolean;
    hasMoreCached: boolean;
    hasMoreRemote: boolean;
    hasIntelligenceItems: boolean;
  },
  t?: Translate,
): string {
  if (!params.hasIntelligenceItems) return "";
  if (params.loadingMore) {
    return params.hasMoreRemote && !params.hasMoreCached
      ? intelligenceT("loadMore.loadingRemote", t)
      : intelligenceT("loadMore.loading", t);
  }
  if (params.hasMoreCached) return intelligenceT("loadMore.scrollCached", t);
  if (params.hasMoreRemote) return intelligenceT("loadMore.scrollRemote", t);
  return intelligenceT("loadMore.done", t);
}

/** Append API page items without duplicate ids. */
export function mergeIntelligencePages(
  existing: AnalysisEvent[],
  incoming: AnalysisEvent[],
): AnalysisEvent[] {
  if (incoming.length === 0) return existing;
  const ids = new Set(existing.map((item) => item.id));
  const merged = [...existing];
  for (const item of incoming) {
    if (!ids.has(item.id)) {
      ids.add(item.id);
      merged.push(item);
    }
  }
  return merged;
}

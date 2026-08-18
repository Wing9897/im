/** App-shell paths for the workset catalog (not nested under /tasks). */
export const WORKSETS_PATH = "/worksets";

export const WORKSET_CATALOG_TABS = ["catalog", "graph"] as const;

export type WorksetCatalogTab = (typeof WORKSET_CATALOG_TABS)[number];

export const DEFAULT_WORKSET_CATALOG_TAB: WorksetCatalogTab = "catalog";

export function isWorksetsPath(pathname: string): boolean {
  return pathname === WORKSETS_PATH || pathname.startsWith(`${WORKSETS_PATH}/`);
}

export function isWorksetCatalogTab(value: string | null): value is WorksetCatalogTab {
  return value != null && (WORKSET_CATALOG_TABS as readonly string[]).includes(value);
}

/** `flow` is accepted as an alias of `graph`. */
export function parseWorksetCatalogTab(tab: string | null): WorksetCatalogTab {
  if (tab === "flow" || tab === "graph") return "graph";
  if (tab === "catalog") return "catalog";
  return DEFAULT_WORKSET_CATALOG_TAB;
}

/** Query key for the graph-tab workset checklist (`?tab=graph&worksetId=`). */
export const WORKSET_GRAPH_FILTER_PARAM = "worksetId";

/** Sentinel for 清除 (none). Missing param still means the default set. */
export const WORKSET_GRAPH_FILTER_NONE = "__none__";

/** `null` means default selection — missing query value. `[]` means none. */
export function parseWorksetGraphFilter(value: string | null): string[] | null {
  const raw = value?.trim() ?? "";
  if (!raw) return null;
  if (raw === WORKSET_GRAPH_FILTER_NONE) return [];
  const ids = raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && part !== WORKSET_GRAPH_FILTER_NONE);
  return ids.length > 0 ? ids : null;
}

export function serializeWorksetGraphFilter(ids: readonly string[]): string {
  return ids.length === 0 ? WORKSET_GRAPH_FILTER_NONE : ids.join(",");
}

export function worksetsCatalogPath(
  tab?: WorksetCatalogTab,
  graphWorksetId?: string | readonly string[] | null,
): string {
  if (!tab || tab === DEFAULT_WORKSET_CATALOG_TAB) return WORKSETS_PATH;
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (tab === "graph" && graphWorksetId != null) {
    const value =
      typeof graphWorksetId === "string" ? graphWorksetId : serializeWorksetGraphFilter(graphWorksetId);
    if (value) params.set(WORKSET_GRAPH_FILTER_PARAM, value);
  }
  return `${WORKSETS_PATH}?${params.toString()}`;
}

/** Workset contents page (lists + toolbar). No in-page flow tab. */
export function worksetDetailPath(worksetId: string): string {
  return `${WORKSETS_PATH}/${encodeURIComponent(worksetId)}`;
}

export function isLegacyTasksWorksetPath(pathname: string): boolean {
  return pathname.startsWith("/tasks/worksets/");
}

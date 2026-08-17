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

/** Query key for the graph-tab workset MenuSelect (`?tab=graph&worksetId=`). */
export const WORKSET_GRAPH_FILTER_PARAM = "worksetId";

/** `null` means 全部 — empty / missing query value. */
export function parseWorksetGraphFilter(value: string | null): string | null {
  const id = value?.trim() ?? "";
  return id.length > 0 ? id : null;
}

export function worksetsCatalogPath(
  tab?: WorksetCatalogTab,
  graphWorksetId?: string | null,
): string {
  if (!tab || tab === DEFAULT_WORKSET_CATALOG_TAB) return WORKSETS_PATH;
  const params = new URLSearchParams();
  params.set("tab", tab);
  if (tab === "graph" && graphWorksetId) {
    params.set(WORKSET_GRAPH_FILTER_PARAM, graphWorksetId);
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

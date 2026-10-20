export const WORKSPACE_TABS = ["tasks", "sources", "graph"] as const;

export type WorkspaceTab = (typeof WORKSPACE_TABS)[number];

/** Tasks list, sources (URL kept), or the pipeline graph on the tasks URL. */
export function resolveWorkspaceTab(pathname: string, tab: string | null): WorkspaceTab {
  if (pathname === "/sources" || pathname.startsWith("/sources/")) return "sources";
  if (pathname === "/tasks" && (tab === "graph" || tab === "flow")) return "graph";
  return "tasks";
}

export function workspaceTabPath(tab: WorkspaceTab): string {
  if (tab === "sources") return "/sources";
  if (tab === "graph") return "/tasks?tab=graph";
  return "/tasks";
}

/** Map primary nav paths → lazy page modules (matches AppRoutes). */
const ROUTE_PREFETCHERS: Record<string, () => Promise<unknown>> = {
  "/monitor": () => import("../pages/monitor/MonitorPage"),
  "/tasks": () => import("../pages/dashboard/DashboardViewer"),
  "/leaderboard": () => import("../pages/leaderboard/LeaderboardPage"),
  "/intelligence": () => import("../pages/intelligence/IntelligencePage"),
  "/timeline": () => import("../pages/timeline/TimelinePage"),
  "/items": () => import("../pages/items/ItemsPage"),
  "/actions": () => import("../pages/actions/ActionsPage"),
  "/sources": () => import("../pages/sources/SourceManagementPage"),
  "/assistant": () => import("../pages/ai/assistant/AssistantPage"),
  "/account": () => import("../pages/account/AccountShell"),
  "/ai": () => import("../pages/ai/AiWorkspacePage"),
  "/ai/provider": () => import("../pages/ai/SettingsAiProviderPage"),
  "/ai/voice": () => import("../pages/ai/SettingsVoicePage"),
  "/ai/analysis-strategy": () =>
    import("../pages/ai/SettingsAnalysisStrategyPage"),
  "/ai/staff": () => import("../pages/ai/SettingsAiStaffPage"),
  "/settings": () => import("../pages/settings/SettingsShared"),
  "/settings/api": () => import("../pages/settings/SettingsApiPage"),
  "/settings/logs": () => import("../pages/logs/LogPage"),
};

const prefetched = new Set<string>();

function resolveTasksPrefetch(path: string): (() => Promise<unknown>) | undefined {
  if (path === "/tasks/new" || /\/tasks\/[^/]+\/edit$/.test(path)) {
    return () => import("../pages/tasks/chat-editor/ChatEditorPage");
  }
  if (/\/tasks\/[^/]+\/agent$/.test(path)) {
    return () => import("../pages/tasks/agent/AgentDetailPage");
  }
  if (/\/tasks\/worksets\//.test(path)) {
    return ROUTE_PREFETCHERS["/tasks"];
  }
  if (path.startsWith("/tasks")) {
    return ROUTE_PREFETCHERS["/tasks"];
  }
  return undefined;
}

function resolveItemsPrefetch(path: string): (() => Promise<unknown>) | undefined {
  if (path === "/items/new" || /\/items\/[^/]+\/edit$/.test(path)) {
    return () => import("../pages/items/form/ItemFormPage");
  }
  if (path === "/items" || path.startsWith("/items/")) {
    return ROUTE_PREFETCHERS["/items"];
  }
  return undefined;
}

/**
 * Warm the lazy chunk for a route on hover/focus so navigation feels snappy.
 * Idempotent; failures are ignored (navigation still loads on demand).
 */
export function prefetchRoute(to: string): void {
  const path = to.split("?")[0] ?? to;
  const loader =
    ROUTE_PREFETCHERS[path] ??
    resolveTasksPrefetch(path) ??
    resolveItemsPrefetch(path) ??
    (path.startsWith("/ai")
      ? ROUTE_PREFETCHERS["/ai"]
      : path.startsWith("/settings")
        ? ROUTE_PREFETCHERS["/settings"]
        : undefined);
  if (!loader || prefetched.has(path)) return;
  prefetched.add(path);
  void loader().catch(() => {
    prefetched.delete(path);
  });
}

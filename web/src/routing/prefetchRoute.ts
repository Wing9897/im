/** Map primary nav paths → lazy page modules (matches AppRoutes). */
const ROUTE_PREFETCHERS: Record<string, () => Promise<unknown>> = {
  "/monitor": () => import("../pages/monitor/MonitorPage"),
  "/tasks": () => import("../pages/dashboard/DashboardViewer"),
  "/worksets": () => import("../pages/dashboard/DashboardViewer"),
  "/worksets/:id": () => import("../pages/worksets/WorksetWorkspacePage"),
  "/schedule": () => import("../pages/schedule/SchedulePage"),
  "/leaderboard": () => import("../pages/leaderboard/LeaderboardPage"),
  "/intelligence": () => import("../pages/intelligence/IntelligencePage"),
  "/timeline": () => import("../pages/timeline/TimelinePage"),
  "/subscriptions": () => import("../pages/subscriptions/SubscriptionsShell"),
  "/subscriptions/mine": () => import("../pages/subscriptions/SubscriptionsMinePage"),
  "/subscriptions/published": () => import("../pages/subscriptions/SubscriptionsPublishedPage"),
  "/subscriptions/account": () => import("../pages/subscriptions/SubscriptionsAccountPage"),
  "/subscriptions/search": () => import("../pages/subscriptions/SubscriptionsSearchPage"),
  "/items": () => import("../pages/items/ItemsPage"),
  "/notify": () => import("../pages/notify/NotifyWorkspacePage"),
  "/sources": () => import("../pages/sources/SourceManagementPage"),
  "/assistant": () => import("../pages/ai/assistant/AssistantPage"),
  "/account": () => import("../pages/account/AccountShell"),
  "/settings/ai": () => import("../pages/settings/SettingsShared"),
  "/settings/ai/provider": () => import("../pages/settings/ai/SettingsAiProviderPage"),
  "/settings/ai/voice": () => import("../pages/settings/ai/SettingsVoicePage"),
  "/settings/ai/staff": () => import("../pages/settings/ai/SettingsAiStaffPage"),
  "/settings": () => import("../pages/settings/SettingsShared"),
  "/settings/integrations": () => import("../pages/settings/SettingsIntegrationsPage"),
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
  if (/^\/worksets\/.+/.test(path)) {
    return ROUTE_PREFETCHERS["/worksets/:id"];
  }
  if (path === "/worksets") {
    return ROUTE_PREFETCHERS["/worksets"];
  }
  return undefined;
}

function resolveSchedulePrefetch(path: string): (() => Promise<unknown>) | undefined {
  if (/\/schedule\/recurring\/[^/]+\/edit$/.test(path)) {
    return () => import("../pages/schedule/RecurringSeriesEditor");
  }
  if (path.startsWith("/schedule")) {
    return ROUTE_PREFETCHERS["/schedule"];
  }
  return undefined;
}

function resolveItemsPrefetch(path: string): (() => Promise<unknown>) | undefined {
  if (path === "/items/finance") {
    return () => import("../pages/items/finance/ItemsFinancePage");
  }
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
    resolveSchedulePrefetch(path) ??
    resolveTasksPrefetch(path) ??
    resolveItemsPrefetch(path) ??
    (path.startsWith("/settings/ai")
      ? ROUTE_PREFETCHERS["/settings/ai"]
      : path.startsWith("/ai")
        ? ROUTE_PREFETCHERS["/settings/ai"]
        : path.startsWith("/settings")
          ? ROUTE_PREFETCHERS["/settings"]
          : path.startsWith("/subscriptions")
            ? ROUTE_PREFETCHERS["/subscriptions"]
            : undefined);
  if (!loader || prefetched.has(path)) return;
  prefetched.add(path);
  void loader().catch(() => {
    prefetched.delete(path);
  });
}

import { ROUTE_PAGES, ROUTE_PREFETCHERS } from "./routeModules";

const prefetched = new Set<string>();

function resolveTasksPrefetch(
  path: string,
): (() => Promise<unknown>) | undefined {
  if (path === "/tasks/new" || /\/tasks\/[^/]+\/edit$/.test(path)) {
    return ROUTE_PAGES.ChatEditorPage;
  }
  if (/\/tasks\/[^/]+\/agent$/.test(path)) {
    return ROUTE_PAGES.AgentDetailPage;
  }
  if (/^\/worksets\/.+/.test(path)) {
    return ROUTE_PREFETCHERS["/worksets/:id"];
  }
  if (path === "/worksets") {
    return ROUTE_PREFETCHERS["/worksets"];
  }
  return undefined;
}

function resolveSchedulePrefetch(
  path: string,
): (() => Promise<unknown>) | undefined {
  if (/\/schedule\/recurring\/[^/]+\/edit$/.test(path)) {
    return ROUTE_PAGES.RecurringSeriesEditor;
  }
  if (path.startsWith("/schedule")) {
    return ROUTE_PREFETCHERS["/schedule"];
  }
  return undefined;
}

function resolveItemsPrefetch(
  path: string,
): (() => Promise<unknown>) | undefined {
  if (path === "/items/finance") {
    return ROUTE_PAGES.ItemsFinancePage;
  }
  if (path === "/items/new" || /\/items\/[^/]+\/edit$/.test(path)) {
    return ROUTE_PAGES.ItemFormPage;
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

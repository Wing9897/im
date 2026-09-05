/**
 * Single source of lazy page modules. AppRoutes registers them via lazyNamed;
 * prefetchRoute warms the same loaders on hover.
 */
export const ROUTE_PAGES = {
  MonitorPage: () => import("../pages/monitor/MonitorPage"),
  DashboardViewer: () => import("../pages/dashboard/DashboardViewer"),
  WorksetWorkspacePage: () => import("../pages/worksets/WorksetWorkspacePage"),
  SchedulePage: () => import("../pages/schedule/SchedulePage"),
  RecurringSeriesEditor: () =>
    import("../pages/schedule/RecurringSeriesEditor"),
  ChatEditorPage: () => import("../pages/tasks/chat-editor/ChatEditorPage"),
  AgentDetailPage: () => import("../pages/tasks/agent/AgentDetailPage"),
  LeaderboardPage: () => import("../pages/leaderboard/LeaderboardPage"),
  IntelligencePage: () => import("../pages/intelligence/IntelligencePage"),
  TimelinePage: () => import("../pages/timeline/TimelinePage"),
  SubscriptionsShell: () => import("../pages/subscriptions/SubscriptionsShell"),
  SubscriptionsMinePage: () =>
    import("../pages/subscriptions/SubscriptionsMinePage"),
  SubscriptionsSearchPage: () =>
    import("../pages/subscriptions/SubscriptionsSearchPage"),
  SubscriptionsPublishedPage: () =>
    import("../pages/subscriptions/SubscriptionsPublishedPage"),
  SubscriptionsIdentityPanel: () =>
    import("../pages/subscriptions/SubscriptionsIdentityPanel"),
  ItemsPage: () => import("../pages/items/ItemsPage"),
  ItemFormPage: () => import("../pages/items/form/ItemFormPage"),
  ItemsFinancePage: () => import("../pages/items/finance/ItemsFinancePage"),
  SourceManagementPage: () => import("../pages/sources/SourceManagementPage"),
  NotifyWorkspacePage: () => import("../pages/notify/NotifyWorkspacePage"),
  AssistantPage: () => import("../pages/assistant/AssistantPage"),
  SettingsAiProviderPage: () =>
    import("../pages/settings/ai/SettingsAiProviderPage"),
  SettingsAiStaffPage: () => import("../pages/settings/ai/SettingsAiStaffPage"),
  SettingsVoicePage: () => import("../pages/settings/ai/SettingsVoicePage"),
  SettingsShared: () => import("../pages/settings/SettingsShared"),
  SettingsGeneralPage: () => import("../pages/settings/SettingsGeneralPage"),
  SettingsDataPage: () => import("../pages/settings/SettingsDataPage"),
  SettingsIntegrationsPage: () =>
    import("../pages/settings/SettingsIntegrationsPage"),
  LogPage: () => import("../pages/logs/LogPage"),
  AccountShell: () => import("../pages/account/AccountShell"),
  AccountIdentityPage: () => import("../pages/account/AccountIdentityPage"),
  AccountDevicesPage: () => import("../pages/account/AccountDevicesPage"),
  AccountKeysPage: () => import("../pages/account/AccountKeysPage"),
  ViewerLayout: () => import("../pages/viewer/ViewerLayout"),
  ViewerTasksPage: () => import("../pages/viewer/ViewerTasksPage"),
  ViewerResultsPage: () => import("../pages/viewer/ViewerResultsPage"),
  ViewerStatusPage: () => import("../pages/viewer/ViewerStatusPage"),
  NotFoundPage: () => import("../pages/NotFoundPage"),
} as const;

/** Primary nav paths → the same loaders AppRoutes registers. */
export const ROUTE_PREFETCHERS: Record<string, () => Promise<unknown>> = {
  "/monitor": ROUTE_PAGES.MonitorPage,
  "/tasks": ROUTE_PAGES.DashboardViewer,
  "/worksets": ROUTE_PAGES.DashboardViewer,
  "/worksets/:id": ROUTE_PAGES.WorksetWorkspacePage,
  "/schedule": ROUTE_PAGES.SchedulePage,
  "/leaderboard": ROUTE_PAGES.LeaderboardPage,
  "/intelligence": ROUTE_PAGES.IntelligencePage,
  "/timeline": ROUTE_PAGES.TimelinePage,
  "/subscriptions": ROUTE_PAGES.SubscriptionsShell,
  "/subscriptions/mine": ROUTE_PAGES.SubscriptionsMinePage,
  "/subscriptions/published": ROUTE_PAGES.SubscriptionsPublishedPage,
  "/subscriptions/account": ROUTE_PAGES.SubscriptionsIdentityPanel,
  "/subscriptions/search": ROUTE_PAGES.SubscriptionsSearchPage,
  "/items": ROUTE_PAGES.ItemsPage,
  "/notify": ROUTE_PAGES.NotifyWorkspacePage,
  "/sources": ROUTE_PAGES.SourceManagementPage,
  "/assistant": ROUTE_PAGES.AssistantPage,
  "/account": ROUTE_PAGES.AccountShell,
  "/settings/ai": ROUTE_PAGES.SettingsShared,
  "/settings/ai/provider": ROUTE_PAGES.SettingsAiProviderPage,
  "/settings/ai/voice": ROUTE_PAGES.SettingsVoicePage,
  "/settings/ai/staff": ROUTE_PAGES.SettingsAiStaffPage,
  "/settings": ROUTE_PAGES.SettingsShared,
  "/settings/integrations": ROUTE_PAGES.SettingsIntegrationsPage,
  "/settings/logs": ROUTE_PAGES.LogPage,
};

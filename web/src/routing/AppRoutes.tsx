import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { SystemSettingsProvider } from "../context/SystemSettingsContext";
import { homePathForMode, readSimpleMode } from "../domain/ui/simpleMode";
import { useSimpleMode } from "../context/SimpleModeContext";
import { LazyPage, lazyNamed } from "./LazyPage";
import { ROUTE_PAGES } from "./routeModules";
import { SimpleModeGate } from "./SimpleModeGate";

/** Shared settings state for /settings and /settings/ai (unsaved drafts survive tab switches). */
function SystemSettingsLayout() {
  return (
    <SystemSettingsProvider>
      <Outlet />
    </SystemSettingsProvider>
  );
}

const startupViewerRoute = (() => {
  const route = new URLSearchParams(window.location.search).get("viewerRoute");
  if (!route) {
    return null;
  }
  if (route === "/") {
    return homePathForMode(readSimpleMode());
  }
  return route.startsWith("/") ? route : `/${route}`;
})();

function DefaultHomeRedirect() {
  const { simpleMode } = useSimpleMode();
  if (startupViewerRoute) {
    return <Navigate to={startupViewerRoute} replace />;
  }
  return <Navigate to={homePathForMode(simpleMode)} replace />;
}

// Module-level lazy registration — same loaders as prefetchRoute (routeModules).
const MonitorPage = lazyNamed(ROUTE_PAGES.MonitorPage, "MonitorPage");
const DashboardViewer = lazyNamed(
  ROUTE_PAGES.DashboardViewer,
  "DashboardViewer",
);
const WorksetWorkspacePage = lazyNamed(
  ROUTE_PAGES.WorksetWorkspacePage,
  "WorksetWorkspacePage",
);
const SchedulePage = lazyNamed(ROUTE_PAGES.SchedulePage, "SchedulePage");
const RecurringSeriesEditor = lazyNamed(
  ROUTE_PAGES.RecurringSeriesEditor,
  "RecurringSeriesEditor",
);
const ChatEditorPage = lazyNamed(ROUTE_PAGES.ChatEditorPage, "ChatEditorPage");
const AgentDetailPage = lazyNamed(
  ROUTE_PAGES.AgentDetailPage,
  "AgentDetailPage",
);
const LeaderboardPage = lazyNamed(
  ROUTE_PAGES.LeaderboardPage,
  "LeaderboardPage",
);
const IntelligencePage = lazyNamed(
  ROUTE_PAGES.IntelligencePage,
  "IntelligencePage",
);
const TimelinePage = lazyNamed(ROUTE_PAGES.TimelinePage, "TimelinePage");
const SubscriptionsShell = lazyNamed(
  ROUTE_PAGES.SubscriptionsShell,
  "SubscriptionsShell",
);
const SubscriptionsMinePage = lazyNamed(
  ROUTE_PAGES.SubscriptionsMinePage,
  "SubscriptionsMinePage",
);
const SubscriptionsSearchPage = lazyNamed(
  ROUTE_PAGES.SubscriptionsSearchPage,
  "SubscriptionsSearchPage",
);
const SubscriptionsPublishedPage = lazyNamed(
  ROUTE_PAGES.SubscriptionsPublishedPage,
  "SubscriptionsPublishedPage",
);
const SubscriptionsAccountPage = lazyNamed(
  ROUTE_PAGES.SubscriptionsIdentityPanel,
  "SubscriptionsIdentityPanel",
);
const ItemsPage = lazyNamed(ROUTE_PAGES.ItemsPage, "ItemsPage");
const ItemFormPage = lazyNamed(ROUTE_PAGES.ItemFormPage, "ItemFormPage");
const ItemsFinancePage = lazyNamed(
  ROUTE_PAGES.ItemsFinancePage,
  "ItemsFinancePage",
);
const SourceManagementPage = lazyNamed(
  ROUTE_PAGES.SourceManagementPage,
  "SourceManagementPage",
);
const NotifyWorkspacePage = lazyNamed(
  ROUTE_PAGES.NotifyWorkspacePage,
  "NotifyWorkspacePage",
);
const AssistantPage = lazyNamed(ROUTE_PAGES.AssistantPage, "AssistantPage");
const SettingsAiProviderPage = lazyNamed(
  ROUTE_PAGES.SettingsAiProviderPage,
  "SettingsAiProviderPage",
);
const SettingsAiStaffPage = lazyNamed(
  ROUTE_PAGES.SettingsAiStaffPage,
  "SettingsAiStaffPage",
);
const SettingsVoicePage = lazyNamed(
  ROUTE_PAGES.SettingsVoicePage,
  "SettingsVoicePage",
);
const SettingsShellPage = lazyNamed(
  ROUTE_PAGES.SettingsShared,
  "SettingsShellPage",
);
const SettingsAiShellPage = lazyNamed(
  ROUTE_PAGES.SettingsShared,
  "SettingsAiShellPage",
);
const SettingsGeneralPage = lazyNamed(
  ROUTE_PAGES.SettingsGeneralPage,
  "SettingsGeneralPage",
);
const SettingsThemePage = lazyNamed(
  ROUTE_PAGES.SettingsShared,
  "SettingsThemePage",
);
const SettingsDataPage = lazyNamed(
  ROUTE_PAGES.SettingsDataPage,
  "SettingsDataPage",
);
const SettingsIntegrationsPage = lazyNamed(
  ROUTE_PAGES.SettingsIntegrationsPage,
  "SettingsIntegrationsPage",
);
const LogPage = lazyNamed(ROUTE_PAGES.LogPage, "LogPage");
const AccountShell = lazyNamed(ROUTE_PAGES.AccountShell, "AccountShell");
const AccountIdentityPage = lazyNamed(
  ROUTE_PAGES.AccountIdentityPage,
  "AccountIdentityPage",
);
const AccountDevicesPage = lazyNamed(
  ROUTE_PAGES.AccountDevicesPage,
  "AccountDevicesPage",
);
const AccountKeysPage = lazyNamed(
  ROUTE_PAGES.AccountKeysPage,
  "AccountKeysPage",
);
const ViewerLayout = lazyNamed(ROUTE_PAGES.ViewerLayout, "ViewerLayout");
const ViewerTasksPage = lazyNamed(
  ROUTE_PAGES.ViewerTasksPage,
  "ViewerTasksPage",
);
const ViewerResultsPage = lazyNamed(
  ROUTE_PAGES.ViewerResultsPage,
  "ViewerResultsPage",
);
const ViewerStatusPage = lazyNamed(
  ROUTE_PAGES.ViewerStatusPage,
  "ViewerStatusPage",
);
const NotFoundPage = lazyNamed(ROUTE_PAGES.NotFoundPage, "NotFoundPage");

/** App route tree — always follows the live router location (no controlled location). */
export function AppRoutes() {
  return (
    <SimpleModeGate>
      <Routes>
        <Route path="/" element={<DefaultHomeRedirect />} />
        <Route path="/monitor" element={<LazyPage Page={MonitorPage} />} />
        <Route path="/worksets" element={<LazyPage Page={DashboardViewer} />} />
        <Route
          path="/worksets/:worksetId"
          element={<LazyPage Page={WorksetWorkspacePage} />}
        />
        <Route path="/tasks" element={<LazyPage Page={DashboardViewer} />} />
        <Route path="/tasks/new" element={<LazyPage Page={ChatEditorPage} />} />
        <Route
          path="/tasks/:taskId/edit"
          element={<LazyPage Page={ChatEditorPage} />}
        />
        <Route
          path="/tasks/:taskId/agent"
          element={<LazyPage Page={AgentDetailPage} />}
        />
        <Route path="/schedule" element={<LazyPage Page={SchedulePage} />} />
        <Route
          path="/schedule/recurring/:id/edit"
          element={<LazyPage Page={RecurringSeriesEditor} />}
        />
        <Route
          path="/leaderboard"
          element={<LazyPage Page={LeaderboardPage} />}
        />
        <Route
          path="/intelligence"
          element={<LazyPage Page={IntelligencePage} />}
        />
        <Route path="/timeline" element={<LazyPage Page={TimelinePage} />} />
        <Route
          path="/subscriptions"
          element={<LazyPage Page={SubscriptionsShell} />}
        >
          <Route
            index
            element={<Navigate to="/subscriptions/mine" replace />}
          />
          <Route
            path="mine"
            element={<LazyPage Page={SubscriptionsMinePage} />}
          />
          <Route
            path="published"
            element={<LazyPage Page={SubscriptionsPublishedPage} />}
          />
          <Route
            path="account"
            element={<LazyPage Page={SubscriptionsAccountPage} />}
          />
          <Route
            path="search"
            element={<LazyPage Page={SubscriptionsSearchPage} />}
          />
        </Route>
        <Route path="/items" element={<LazyPage Page={ItemsPage} />} />
        <Route
          path="/items/finance"
          element={<LazyPage Page={ItemsFinancePage} />}
        />
        <Route path="/items/new" element={<LazyPage Page={ItemFormPage} />} />
        <Route
          path="/items/:itemId/edit"
          element={<LazyPage Page={ItemFormPage} />}
        />
        <Route
          path="/items/category/:categoryId"
          element={<LazyPage Page={ItemsPage} />}
        />
        <Route
          path="/sources"
          element={<LazyPage Page={SourceManagementPage} />}
        />
        <Route
          path="/notify"
          element={<LazyPage Page={NotifyWorkspacePage} />}
        />
        <Route path="/assistant" element={<LazyPage Page={AssistantPage} />} />
        <Route path="/account" element={<LazyPage Page={AccountShell} />}>
          <Route index element={<Navigate to="/account/identity" replace />} />
          <Route
            path="identity"
            element={<LazyPage Page={AccountIdentityPage} />}
          />
          <Route
            path="devices"
            element={<LazyPage Page={AccountDevicesPage} />}
          />
          <Route path="keys" element={<LazyPage Page={AccountKeysPage} />} />
        </Route>
        <Route element={<SystemSettingsLayout />}>
          <Route
            path="settings/ai"
            element={<LazyPage Page={SettingsAiShellPage} />}
          >
            <Route
              index
              element={<Navigate to="/settings/ai/provider" replace />}
            />
            <Route
              path="provider"
              element={<LazyPage Page={SettingsAiProviderPage} />}
            />
            <Route
              path="voice"
              element={<LazyPage Page={SettingsVoicePage} />}
            />
            <Route
              path="staff"
              element={<LazyPage Page={SettingsAiStaffPage} />}
            />
            <Route path="*" element={<LazyPage Page={NotFoundPage} />} />
          </Route>
          <Route
            path="settings"
            element={<LazyPage Page={SettingsShellPage} />}
          >
            <Route
              index
              element={<Navigate to="/settings/general" replace />}
            />
            <Route
              path="general"
              element={<LazyPage Page={SettingsGeneralPage} />}
            />
            <Route
              path="theme"
              element={<LazyPage Page={SettingsThemePage} />}
            />
            <Route path="data" element={<LazyPage Page={SettingsDataPage} />} />
            <Route
              path="integrations"
              element={<LazyPage Page={SettingsIntegrationsPage} />}
            />
            <Route path="logs" element={<LazyPage Page={LogPage} />} />
          </Route>
        </Route>
        <Route path="/viewer" element={<LazyPage Page={ViewerLayout} />}>
          <Route index element={<Navigate to="/viewer/tasks" replace />} />
          <Route path="tasks" element={<LazyPage Page={ViewerTasksPage} />} />
          <Route
            path="results"
            element={<LazyPage Page={ViewerResultsPage} />}
          />
          <Route path="status" element={<LazyPage Page={ViewerStatusPage} />} />
        </Route>
        <Route path="*" element={<LazyPage Page={NotFoundPage} />} />
      </Routes>
    </SimpleModeGate>
  );
}

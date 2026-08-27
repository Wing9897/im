import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { SystemSettingsProvider } from "../context/SystemSettingsContext";
import { homePathForMode, readSimpleMode } from "../domain/ui/simpleMode";
import { useSimpleMode } from "../context/SimpleModeContext";
import { LazyPage, lazyNamed } from "./LazyPage";
import { SimpleModeGate } from "./SimpleModeGate";

/** Shared settings state for /ai + /settings (unsaved drafts survive tab switches). */
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

// Module-level lazy registration — stable exotic types for the route tree lifetime.
const MonitorPage = lazyNamed(() => import("../pages/monitor/MonitorPage"), "MonitorPage");
const DashboardViewer = lazyNamed(() => import("../pages/dashboard/DashboardViewer"), "DashboardViewer");
const WorksetWorkspacePage = lazyNamed(
  () => import("../pages/worksets/WorksetWorkspacePage"),
  "WorksetWorkspacePage",
);
const SchedulePage = lazyNamed(() => import("../pages/schedule/SchedulePage"), "SchedulePage");
const RecurringSeriesEditor = lazyNamed(
  () => import("../pages/schedule/RecurringSeriesEditor"),
  "RecurringSeriesEditor",
);
const ChatEditorPage = lazyNamed(() => import("../pages/tasks/chat-editor/ChatEditorPage"), "ChatEditorPage");
const AgentDetailPage = lazyNamed(
  () => import("../pages/tasks/agent/AgentDetailPage"),
  "AgentDetailPage",
);
const LeaderboardPage = lazyNamed(() => import("../pages/leaderboard/LeaderboardPage"), "LeaderboardPage");
const IntelligencePage = lazyNamed(() => import("../pages/intelligence/IntelligencePage"), "IntelligencePage");
const TimelinePage = lazyNamed(() => import("../pages/timeline/TimelinePage"), "TimelinePage");
const SubscriptionsShell = lazyNamed(
  () => import("../pages/subscriptions/SubscriptionsShell"),
  "SubscriptionsShell",
);
const SubscriptionsMinePage = lazyNamed(
  () => import("../pages/subscriptions/SubscriptionsMinePage"),
  "SubscriptionsMinePage",
);
const SubscriptionsSearchPage = lazyNamed(
  () => import("../pages/subscriptions/SubscriptionsSearchPage"),
  "SubscriptionsSearchPage",
);
const SubscriptionsPublishedPage = lazyNamed(
  () => import("../pages/subscriptions/SubscriptionsPublishedPage"),
  "SubscriptionsPublishedPage",
);
const ItemsPage = lazyNamed(() => import("../pages/items/ItemsPage"), "ItemsPage");
const ItemFormPage = lazyNamed(() => import("../pages/items/form/ItemFormPage"), "ItemFormPage");
const ItemsFinancePage = lazyNamed(
  () => import("../pages/items/finance/ItemsFinancePage"),
  "ItemsFinancePage",
);
const SourceManagementPage = lazyNamed(
  () => import("../pages/sources/SourceManagementPage"),
  "SourceManagementPage",
);
const NotifyWorkspacePage = lazyNamed(
  () => import("../pages/notify/NotifyWorkspacePage"),
  "NotifyWorkspacePage",
);
const AssistantPage = lazyNamed(() => import("../pages/ai/assistant/AssistantPage"), "AssistantPage");
const AiWorkspacePage = lazyNamed(() => import("../pages/ai/AiWorkspacePage"), "AiWorkspacePage");
const SettingsAiProviderPage = lazyNamed(
  () => import("../pages/ai/SettingsAiProviderPage"),
  "SettingsAiProviderPage",
);
const SettingsAiStaffPage = lazyNamed(
  () => import("../pages/ai/SettingsAiStaffPage"),
  "SettingsAiStaffPage",
);
const SettingsVoicePage = lazyNamed(() => import("../pages/ai/SettingsVoicePage"), "SettingsVoicePage");
const SettingsAnalysisStrategyPage = lazyNamed(
  () => import("../pages/ai/SettingsAnalysisStrategyPage"),
  "SettingsAnalysisStrategyPage",
);
const SettingsShellPage = lazyNamed(() => import("../pages/settings/SettingsShared"), "SettingsShellPage");
const SettingsGeneralPage = lazyNamed(() => import("../pages/settings/SettingsGeneralPage"), "SettingsGeneralPage");
const SettingsThemePage = lazyNamed(() => import("../pages/settings/SettingsThemePage"), "SettingsThemePage");
const SettingsDataPage = lazyNamed(() => import("../pages/settings/SettingsDataPage"), "SettingsDataPage");
const SettingsIntegrationsPage = lazyNamed(
  () => import("../pages/settings/SettingsIntegrationsPage"),
  "SettingsIntegrationsPage",
);
const LogPage = lazyNamed(() => import("../pages/logs/LogPage"), "LogPage");
const AccountShell = lazyNamed(() => import("../pages/account/AccountShell"), "AccountShell");
const AccountIdentityPage = lazyNamed(
  () => import("../pages/account/AccountIdentityPage"),
  "AccountIdentityPage",
);
const AccountDevicesPage = lazyNamed(
  () => import("../pages/account/AccountDevicesPage"),
  "AccountDevicesPage",
);
const AccountKeysPage = lazyNamed(() => import("../pages/account/AccountKeysPage"), "AccountKeysPage");
const ViewerLayout = lazyNamed(() => import("../pages/viewer/ViewerLayout"), "ViewerLayout");
const ViewerTasksPage = lazyNamed(() => import("../pages/viewer/ViewerTasksPage"), "ViewerTasksPage");
const ViewerResultsPage = lazyNamed(() => import("../pages/viewer/ViewerResultsPage"), "ViewerResultsPage");
const ViewerStatusPage = lazyNamed(() => import("../pages/viewer/ViewerStatusPage"), "ViewerStatusPage");

/** App route tree — always follows the live router location (no controlled location). */
export function AppRoutes() {
  return (
    <SimpleModeGate>
      <Routes>
        <Route path="/" element={<DefaultHomeRedirect />} />
        <Route path="/monitor" element={<LazyPage Page={MonitorPage} />} />
        <Route path="/worksets" element={<LazyPage Page={DashboardViewer} />} />
        <Route path="/worksets/:worksetId" element={<LazyPage Page={WorksetWorkspacePage} />} />
        <Route path="/tasks" element={<LazyPage Page={DashboardViewer} />} />
        <Route path="/tasks/new" element={<LazyPage Page={ChatEditorPage} />} />
        <Route path="/tasks/:taskId/edit" element={<LazyPage Page={ChatEditorPage} />} />
        <Route path="/tasks/:taskId/agent" element={<LazyPage Page={AgentDetailPage} />} />
        <Route path="/schedule" element={<LazyPage Page={SchedulePage} />} />
        <Route
          path="/schedule/recurring/:id/edit"
          element={<LazyPage Page={RecurringSeriesEditor} />}
        />
        <Route path="/leaderboard" element={<LazyPage Page={LeaderboardPage} />} />
        <Route path="/intelligence" element={<LazyPage Page={IntelligencePage} />} />
        <Route path="/timeline" element={<LazyPage Page={TimelinePage} />} />
        <Route path="/subscriptions" element={<LazyPage Page={SubscriptionsShell} />}>
          <Route index element={<Navigate to="/subscriptions/mine" replace />} />
          <Route path="mine" element={<LazyPage Page={SubscriptionsMinePage} />} />
          <Route path="published" element={<LazyPage Page={SubscriptionsPublishedPage} />} />
          <Route path="search" element={<LazyPage Page={SubscriptionsSearchPage} />} />
        </Route>
        <Route path="/items" element={<LazyPage Page={ItemsPage} />} />
        <Route path="/items/finance" element={<LazyPage Page={ItemsFinancePage} />} />
        <Route path="/items/new" element={<LazyPage Page={ItemFormPage} />} />
        <Route path="/items/:itemId/edit" element={<LazyPage Page={ItemFormPage} />} />
        <Route path="/items/category/:categoryId" element={<LazyPage Page={ItemsPage} />} />
        <Route path="/sources" element={<LazyPage Page={SourceManagementPage} />} />
        <Route path="/notify" element={<LazyPage Page={NotifyWorkspacePage} />} />
        <Route path="/assistant" element={<LazyPage Page={AssistantPage} />} />
        <Route path="/account" element={<LazyPage Page={AccountShell} />}>
          <Route index element={<Navigate to="/account/identity" replace />} />
          <Route path="identity" element={<LazyPage Page={AccountIdentityPage} />} />
          <Route path="devices" element={<LazyPage Page={AccountDevicesPage} />} />
          <Route path="keys" element={<LazyPage Page={AccountKeysPage} />} />
        </Route>
        <Route element={<SystemSettingsLayout />}>
          <Route path="ai" element={<LazyPage Page={AiWorkspacePage} />}>
            <Route index element={<Navigate to="/ai/provider" replace />} />
            <Route path="provider" element={<LazyPage Page={SettingsAiProviderPage} />} />
            <Route path="voice" element={<LazyPage Page={SettingsVoicePage} />} />
            <Route path="analysis-strategy" element={<LazyPage Page={SettingsAnalysisStrategyPage} />} />
            <Route path="staff" element={<LazyPage Page={SettingsAiStaffPage} />} />
          </Route>
          <Route path="settings" element={<LazyPage Page={SettingsShellPage} />}>
            <Route index element={<Navigate to="/settings/general" replace />} />
            <Route path="general" element={<LazyPage Page={SettingsGeneralPage} />} />
            <Route path="theme" element={<LazyPage Page={SettingsThemePage} />} />
            <Route path="data" element={<LazyPage Page={SettingsDataPage} />} />
            <Route path="integrations" element={<LazyPage Page={SettingsIntegrationsPage} />} />
            <Route path="logs" element={<LazyPage Page={LogPage} />} />
          </Route>
        </Route>
        <Route path="/viewer" element={<LazyPage Page={ViewerLayout} />}>
          <Route index element={<Navigate to="/viewer/tasks" replace />} />
          <Route path="tasks" element={<LazyPage Page={ViewerTasksPage} />} />
          <Route path="results" element={<LazyPage Page={ViewerResultsPage} />} />
          <Route path="status" element={<LazyPage Page={ViewerStatusPage} />} />
        </Route>
        <Route path="*" element={<DefaultHomeRedirect />} />
      </Routes>
    </SimpleModeGate>
  );
}

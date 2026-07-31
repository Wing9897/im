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
const ChatEditorPage = lazyNamed(() => import("../pages/tasks/chat-editor/ChatEditorPage"), "ChatEditorPage");
const ProjectDetailPage = lazyNamed(
  () => import("../pages/tasks/project/ProjectDetailPage"),
  "ProjectDetailPage",
);
const LeaderboardPage = lazyNamed(() => import("../pages/leaderboard/LeaderboardPage"), "LeaderboardPage");
const IntelligencePage = lazyNamed(() => import("../pages/intelligence/IntelligencePage"), "IntelligencePage");
const TimelinePage = lazyNamed(() => import("../pages/timeline/TimelinePage"), "TimelinePage");
const SourceManagementPage = lazyNamed(
  () => import("../pages/sources/SourceManagementPage"),
  "SourceManagementPage",
);
const ActionsPage = lazyNamed(() => import("../pages/actions/ActionsPage"), "ActionsPage");
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
const SettingsApiPage = lazyNamed(() => import("../pages/settings/SettingsApiPage"), "SettingsApiPage");
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
        <Route
          path="/wall"
          element={<Navigate to="/monitor" replace state={{ monitorViewMode: "wall" }} />}
        />
        <Route path="/tasks" element={<LazyPage Page={DashboardViewer} />} />
        <Route path="/tasks/new" element={<LazyPage Page={ChatEditorPage} />} />
        <Route path="/tasks/:taskId/edit" element={<LazyPage Page={ChatEditorPage} />} />
        <Route path="/tasks/:taskId/project" element={<LazyPage Page={ProjectDetailPage} />} />
        <Route path="/leaderboard" element={<LazyPage Page={LeaderboardPage} />} />
        <Route path="/intelligence" element={<LazyPage Page={IntelligencePage} />} />
        <Route path="/timeline" element={<LazyPage Page={TimelinePage} />} />
        <Route path="/accounts" element={<LazyPage Page={SourceManagementPage} />} />
        <Route path="/actions" element={<LazyPage Page={ActionsPage} />} />
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
            <Route path="api" element={<LazyPage Page={SettingsApiPage} />} />
            <Route path="logs" element={<LazyPage Page={LogPage} />} />
          </Route>
        </Route>
        <Route path="/logs" element={<Navigate to="/settings/logs" replace />} />
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

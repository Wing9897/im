import { Navigate, useLocation } from "react-router-dom";
import { useSimpleMode } from "../context/SimpleModeContext";
import {
  isSimpleModeHiddenAiTab,
  isSimpleModeHiddenPath,
  isSimpleModeHiddenWorksetTasksTab,
  SIMPLE_MODE_HOME,
} from "../domain/ui/simpleMode";
import { WORKSETS_PATH } from "../domain/worksets/worksetRoutes";

/**
 * When simple mode is on, bounce users off collect/analyze routes,
 * `/tasks` (list + editors), leftover `/worksets?tab=tasks` bookmarks (stay on `/worksets`,
 * do not bounce via `/tasks`), and the legacy analysis-strategy URL.
 */
export function SimpleModeGate({ children }: { children: React.ReactNode }) {
  const { simpleMode } = useSimpleMode();
  const { pathname, search } = useLocation();

  if (simpleMode && isSimpleModeHiddenWorksetTasksTab(pathname, search)) {
    return <Navigate to={WORKSETS_PATH} replace />;
  }

  if (
    simpleMode &&
    (isSimpleModeHiddenPath(pathname) || isSimpleModeHiddenAiTab(pathname))
  ) {
    return <Navigate to={SIMPLE_MODE_HOME} replace />;
  }

  return children;
}

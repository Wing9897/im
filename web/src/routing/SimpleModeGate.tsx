import { Navigate, useLocation } from "react-router-dom";
import { useSimpleMode } from "../context/SimpleModeContext";
import {
  isSimpleModeHiddenAiTab,
  isSimpleModeHiddenPath,
  SIMPLE_MODE_HOME,
} from "../domain/ui/simpleMode";

/**
 * When simple mode is on, bounce users off collect/analyze routes,
 * the Tasks page, and the legacy analysis-strategy URL onto the calendar home.
 */
export function SimpleModeGate({ children }: { children: React.ReactNode }) {
  const { simpleMode } = useSimpleMode();
  const { pathname } = useLocation();

  if (
    simpleMode &&
    (isSimpleModeHiddenPath(pathname) || isSimpleModeHiddenAiTab(pathname))
  ) {
    return <Navigate to={SIMPLE_MODE_HOME} replace />;
  }

  return children;
}

import { Navigate, useLocation } from "react-router-dom";
import { useSimpleMode } from "../context/SimpleModeContext";
import {
  isSimpleModeHiddenAiTab,
  isSimpleModeHiddenPath,
  SIMPLE_MODE_HOME,
} from "../domain/ui/simpleMode";

/**
 * When simple mode is on, bounce users off collect/analyze routes
 * (and analysis-strategy AI tab) onto the calendar home.
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

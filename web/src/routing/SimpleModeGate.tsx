import { Navigate, useLocation } from "react-router-dom";
import { useSimpleMode } from "../context/SimpleModeContext";
import { isSimpleModeHiddenPath, SIMPLE_MODE_HOME } from "../domain/ui/simpleMode";

/**
 * When simple mode is on, bounce users off collect/analyze routes
 * and `/tasks` (list + editors). `/worksets` stays on the catalog.
 */
export function SimpleModeGate({ children }: { children: React.ReactNode }) {
  const { simpleMode } = useSimpleMode();
  const { pathname } = useLocation();

  if (simpleMode && isSimpleModeHiddenPath(pathname)) {
    return <Navigate to={SIMPLE_MODE_HOME} replace />;
  }

  return children;
}

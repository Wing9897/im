import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  isMonitorViewMode,
  type MonitorViewMode,
} from "../../../domain/monitor/monitorViewMode";
import { useDeepLinkFingerprint } from "../../../hooks/useDeepLinkFingerprint";

type MonitorRouteState = {
  monitorViewMode?: MonitorViewMode;
};

/**
 * Applies view mode from router location state or `?view=` query, then clears
 * the one-shot signal. Re-applies when a later navigation brings a new mode
 * (unlike a lifelong latch that ignored every subsequent deep link).
 */
export function useMonitorRouteState(setViewMode: (mode: MonitorViewMode) => void) {
  const location = useLocation();
  const navigate = useNavigate();
  const deepLinkGate = useDeepLinkFingerprint();

  useEffect(() => {
    const stateMode = (location.state as MonitorRouteState | null)?.monitorViewMode;
    const params = new URLSearchParams(location.search);
    const queryMode = params.get("view");
    const mode =
      stateMode === "wall" || stateMode === "card" || stateMode === "list"
        ? stateMode
        : isMonitorViewMode(queryMode)
          ? queryMode
          : null;
    if (!mode) {
      // No pending signal — allow a future ?view=/state to apply.
      deepLinkGate(location.key, null);
      return;
    }

    if (deepLinkGate(location.key, mode) === "skip") {
      return;
    }

    setViewMode(mode);
    if (params.has("view")) {
      params.delete("view");
      const nextSearch = params.toString();
      navigate(
        `${location.pathname}${nextSearch ? `?${nextSearch}` : ""}`,
        { replace: true, state: null },
      );
      return;
    }
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [deepLinkGate, location.key, location.pathname, location.search, location.state, navigate, setViewMode]);
}

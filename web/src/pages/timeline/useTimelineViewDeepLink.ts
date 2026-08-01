import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useDeepLinkFingerprint } from "../../hooks/useDeepLinkFingerprint";

function isTimelineViewMode(value: string | null): value is "calendar" | "gantt" {
  return value === "calendar" || value === "gantt";
}

/**
 * One-shot `/timeline?view=calendar|gantt` deep-link (Monitor-style).
 * Apply then clear `?view=` so later UI toggles are not forced by a sticky URL.
 */
export function useTimelineViewDeepLink(
  setViewMode: (mode: "calendar" | "gantt") => void,
): void {
  const location = useLocation();
  const navigate = useNavigate();
  const deepLinkGate = useDeepLinkFingerprint();
  const urlView = new URLSearchParams(location.search).get("view");

  useEffect(() => {
    if (!isTimelineViewMode(urlView)) {
      deepLinkGate(location.key, null);
      return;
    }
    if (deepLinkGate(location.key, urlView) === "skip") {
      return;
    }
    setViewMode(urlView);
    const params = new URLSearchParams(location.search);
    if (!params.has("view")) {
      return;
    }
    params.delete("view");
    const nextSearch = params.toString();
    navigate(
      `${location.pathname}${nextSearch ? `?${nextSearch}` : ""}`,
      { replace: true },
    );
  }, [
    deepLinkGate,
    setViewMode,
    location.key,
    location.pathname,
    location.search,
    navigate,
    urlView,
  ]);
}

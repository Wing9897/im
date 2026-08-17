import { useCallback, useEffect } from "react";
import {
  SIDEBAR_COLLAPSED_EVENT,
  SIDEBAR_COLLAPSED_KEY,
} from "../domain/prefs";
import { useSyncedLocalStorage } from "./useSyncedLocalStorage";

export { SIDEBAR_COLLAPSED_KEY };

function readCollapsed(): boolean {
  try {
    const raw = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (raw === null) return true;
    return raw === "1";
  } catch {
    return true;
  }
}

function persistCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/**
 * Shared sidebar overlay open/closed state (localStorage `im:sidebar-collapsed`).
 * Overlay does not reserve layout width — pages stay full-bleed.
 * Driven by the overlay edge chevron in AppSidebar (not title-bar chrome).
 * Missing key defaults to collapsed (immersive).
 */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useSyncedLocalStorage({
    key: SIDEBAR_COLLAPSED_KEY,
    eventName: SIDEBAR_COLLAPSED_EVENT,
    read: readCollapsed,
    write: persistCollapsed,
  });

  useEffect(() => {
    document.documentElement.style.removeProperty("--app-sidebar-width");
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, [setCollapsed]);

  return { collapsed, setCollapsed, toggleCollapsed } as const;
}

import { useCallback, useEffect } from "react";
import {
  SIDEBAR_COLLAPSED_EVENT,
  SIDEBAR_COLLAPSED_KEY,
} from "../domain/prefs";
import { useSyncedLocalStorage } from "./useSyncedLocalStorage";

export { SIDEBAR_COLLAPSED_KEY };

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function applySidebarWidth(collapsed: boolean): void {
  document.documentElement.style.setProperty(
    "--app-sidebar-width",
    collapsed
      ? "var(--app-sidebar-width-collapsed, 56px)"
      : "200px",
  );
}

function persistCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    /* ignore */
  }
  applySidebarWidth(collapsed);
}

/**
 * Shared sidebar collapse state (localStorage `im:sidebar-collapsed`).
 * Used by AppSidebar, DesktopTitleBar, and AppTopBar.
 */
export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useSyncedLocalStorage({
    key: SIDEBAR_COLLAPSED_KEY,
    eventName: SIDEBAR_COLLAPSED_EVENT,
    read: readCollapsed,
    write: persistCollapsed,
  });

  useEffect(() => {
    applySidebarWidth(collapsed);
  }, [collapsed]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, [setCollapsed]);

  return { collapsed, setCollapsed, toggleCollapsed } as const;
}

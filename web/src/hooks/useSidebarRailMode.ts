import {
  SIDEBAR_RAIL_MODE_EVENT,
  SIDEBAR_RAIL_MODE_KEY,
} from "../domain/ui/chromePersistedKeys";
import { useSyncedLocalStorage } from "./useSyncedLocalStorage";

export type SidebarRailMode = "nav" | "history";

export { SIDEBAR_RAIL_MODE_KEY };

function readRailMode(): SidebarRailMode {
  try {
    const raw = window.localStorage.getItem(SIDEBAR_RAIL_MODE_KEY);
    return raw === "history" ? "history" : "nav";
  } catch {
    return "nav";
  }
}

function persistRailMode(mode: SidebarRailMode): void {
  try {
    window.localStorage.setItem(SIDEBAR_RAIL_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/** Persisted sidebar top-rail mode: 選單 (nav) vs 紀錄 (history). */
export function useSidebarRailMode() {
  const [mode, setMode] = useSyncedLocalStorage({
    key: SIDEBAR_RAIL_MODE_KEY,
    eventName: SIDEBAR_RAIL_MODE_EVENT,
    read: readRailMode,
    write: persistRailMode,
  });

  return { mode, setMode } as const;
}

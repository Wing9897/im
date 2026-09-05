import { SIDEBAR_PINNED_EVENT, SIDEBAR_PINNED_KEY } from "../domain/prefs";
import { useSyncedLocalStorage } from "./useSyncedLocalStorage";

export { SIDEBAR_PINNED_KEY };

/** Pages-pane class when the sidebar is docked and should push layout (~200px). */
export const SIDEBAR_PINNED_LAYOUT_CLASS = "im-shell-pages--sidebar-pinned";

function readPinned(): boolean {
  try {
    const raw = window.localStorage.getItem(SIDEBAR_PINNED_KEY);
    if (raw === null) return false;
    return raw === "1";
  } catch {
    return false;
  }
}

function persistPinned(pinned: boolean): void {
  try {
    window.localStorage.setItem(SIDEBAR_PINNED_KEY, pinned ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/**
 * Shared sidebar pin state (localStorage `im:sidebar-pinned`).
 * Default unpinned: overlay drawer, pages stay full-bleed.
 * Pinned: docked rail that reserves `--app-sidebar-width` in the pages pane.
 */
export function useSidebarPinned() {
  const [pinned, setPinned] = useSyncedLocalStorage({
    key: SIDEBAR_PINNED_KEY,
    eventName: SIDEBAR_PINNED_EVENT,
    read: readPinned,
    write: persistPinned,
  });

  return { pinned, setPinned } as const;
}

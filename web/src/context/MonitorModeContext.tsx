import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  MONITOR_MODE_KEY,
  PAGES_LAST_PATH_KEY,
} from "../domain/prefs";

export type MonitorMode = "pages" | "canvas";

/** If navigate-first never lands on the target, force pages so we don't stick on canvas. */
const PENDING_PAGES_TIMEOUT_MS = 1500;

export { MONITOR_MODE_KEY, PAGES_LAST_PATH_KEY };

function readStoredMode(): MonitorMode {
  try {
    const raw = window.localStorage.getItem(MONITOR_MODE_KEY);
    if (raw === "canvas" || raw === "pages") {
      return raw;
    }
  } catch {
    // ignore
  }
  return "pages";
}

function readPagesLastPath(): string {
  try {
    const raw = window.localStorage.getItem(PAGES_LAST_PATH_KEY);
    if (raw && raw.startsWith("/")) {
      return raw;
    }
  } catch {
    // ignore
  }
  return "/monitor";
}

function writeMode(mode: MonitorMode): void {
  try {
    window.localStorage.setItem(MONITOR_MODE_KEY, mode);
  } catch {
    // ignore
  }
}

function writePagesLastPath(path: string): void {
  try {
    window.localStorage.setItem(PAGES_LAST_PATH_KEY, path);
  } catch {
    // ignore
  }
}

function locationPath(loc: { pathname: string; search: string; hash: string }): string {
  return `${loc.pathname}${loc.search}${loc.hash}`;
}

interface MonitorModeContextValue {
  monitorMode: MonitorMode;
  setMonitorMode: (mode: MonitorMode) => void;
  /** Switch to pages mode and navigate to a specific path (widget "open in pages"). */
  openInPages: (path: string) => void;
}

const MonitorModeContext = createContext<MonitorModeContextValue | null>(null);

/**
 * Pages ↔ canvas mode owner (device-local LS only).
 *
 * INVARIANTS:
 * - `im:monitor-mode` / `im:pages-last-path` stay in localStorage — never migrate
 *   into SQLite ui-prefs (device chrome, not cross-device SoT).
 * - canvas→pages: navigate first, flip `monitorMode` only after location matches
 *   `pendingPagesTarget` (or timeout). Do NOT set mode to pages before navigate.
 * - Keep `setMonitorMode` / `openInPages` identity-stable via refs — context churn
 *   remounts lazy routes.
 * Regression fences: canvas nav tests, `Board.smoke.test.tsx`.
 */
export function MonitorModeProvider({ children }: { children: ReactNode }) {
  const [monitorMode, setMonitorModeState] = useState<MonitorMode>(() =>
    typeof window === "undefined" ? "pages" : readStoredMode(),
  );
  const location = useLocation();
  const navigate = useNavigate();

  // Keep latest location/mode/navigate in refs so setMonitorMode (and openInPages)
  // stay identity-stable across pathname changes — avoids shell-wide context churn
  // that remounts lazy routes (same failure mode as the old per-render lazyPage bug).
  const locationRef = useRef(location);
  locationRef.current = location;
  const monitorModeRef = useRef(monitorMode);
  monitorModeRef.current = monitorMode;
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  // canvas→pages: navigate first while still showing canvas; flip mode only once
  // location matches the target (avoids flashing the previous pages view).
  const pendingPagesTargetRef = useRef<string | null>(null);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingTimeout = useCallback(() => {
    if (pendingTimeoutRef.current != null) {
      clearTimeout(pendingTimeoutRef.current);
      pendingTimeoutRef.current = null;
    }
  }, []);

  const clearPending = useCallback(() => {
    clearPendingTimeout();
    pendingPagesTargetRef.current = null;
  }, [clearPendingTimeout]);

  const armPendingTimeout = useCallback(() => {
    clearPendingTimeout();
    pendingTimeoutRef.current = setTimeout(() => {
      pendingTimeoutRef.current = null;
      if (pendingPagesTargetRef.current == null) {
        return;
      }
      // Navigate never matched — force navigate to the pending target, then pages.
      const target = pendingPagesTargetRef.current;
      pendingPagesTargetRef.current = null;
      writeMode("pages");
      setMonitorModeState("pages");
      if (target != null && locationPath(locationRef.current) !== target) {
        navigateRef.current(target, { replace: true });
      }
    }, PENDING_PAGES_TIMEOUT_MS);
  }, [clearPendingTimeout]);

  useEffect(() => () => clearPendingTimeout(), [clearPendingTimeout]);

  // When pending navigate lands on the target path, switch canvas → pages.
  useEffect(() => {
    const pending = pendingPagesTargetRef.current;
    if (pending == null) {
      return;
    }
    if (locationPath(location) === pending) {
      clearPending();
      writeMode("pages");
      setMonitorModeState("pages");
    }
  }, [clearPending, location]);

  // Keep last pages path fresh while in pages mode
  useEffect(() => {
    if (monitorMode !== "pages") {
      return;
    }
    const path = locationPath(location);
    if (path.startsWith("/")) {
      writePagesLastPath(path);
    }
  }, [location, monitorMode]);

  const setMonitorMode = useCallback(
    (mode: MonitorMode) => {
      if (mode === monitorModeRef.current) {
        return;
      }
      if (mode === "canvas") {
        clearPending();
        const path = locationPath(locationRef.current);
        if (path.startsWith("/")) {
          writePagesLastPath(path);
        }
        writeMode(mode);
        setMonitorModeState(mode);
        return;
      }

      // mode === "pages" — navigate first (while canvas still shows), then commit
      // when location matches. Navigate outside setState — calling navigate inside
      // an updater runs during render and races with shell updates.
      const target = readPagesLastPath();
      writePagesLastPath(target);
      const here = locationPath(locationRef.current);
      if (here === target) {
        clearPending();
        writeMode("pages");
        setMonitorModeState("pages");
        return;
      }
      pendingPagesTargetRef.current = target;
      armPendingTimeout();
      navigateRef.current(target, { replace: true });
    },
    [armPendingTimeout, clearPending],
  );

  const openInPages = useCallback(
    (path: string) => {
      const target = path.startsWith("/") ? path : `/${path}`;
      writePagesLastPath(target);
      const here = locationPath(locationRef.current);
      if (here === target) {
        clearPending();
        writeMode("pages");
        setMonitorModeState("pages");
        return;
      }
      // Same pending path as setMonitorMode("pages"): stay on canvas until match.
      pendingPagesTargetRef.current = target;
      armPendingTimeout();
      navigateRef.current(target);
    },
    [armPendingTimeout, clearPending],
  );

  const value = useMemo(
    () => ({ monitorMode, setMonitorMode, openInPages }),
    [monitorMode, openInPages, setMonitorMode],
  );

  return (
    <MonitorModeContext.Provider value={value}>{children}</MonitorModeContext.Provider>
  );
}

export function useMonitorMode(): MonitorModeContextValue {
  const ctx = useContext(MonitorModeContext);
  if (!ctx) {
    throw new Error("useMonitorMode must be used within MonitorModeProvider");
  }
  return ctx;
}

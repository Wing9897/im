/**
 * Visibility-aware timer for focal (Bing) background auto-refresh.
 * Interval hours live in device-local prefs beside the focal cache.
 */

import { useEffect } from "react";
import {
  advanceAndMaterializeFocal,
  applyBgImage,
  getStoredThemeId,
  isFocalRefreshDue,
  loadBgOpacity,
  loadFocalCache,
  loadFocalRefreshHours,
  resolveThemeBgMode,
} from "../styles/themeData";
import { getAppLocale } from "../i18n/locale";

const POLL_MS = 60_000;

async function maybeRefreshFocal(): Promise<void> {
  const themeId = getStoredThemeId();
  if (resolveThemeBgMode(themeId) !== "focal") return;
  const hours = loadFocalRefreshHours();
  if (hours <= 0) return;
  if (!isFocalRefreshDue(loadFocalCache(), hours)) return;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    return;
  }
  const { applyUrl } = await advanceAndMaterializeFocal(getAppLocale());
  const activeId = getStoredThemeId();
  if (resolveThemeBgMode(activeId) !== "focal") return;
  if (applyUrl) {
    applyBgImage(applyUrl, loadBgOpacity(activeId), "focal");
  }
}

/**
 * When the active theme uses focal BG and a refresh interval is set,
 * advance Bing idx on a visibility-aware timer and re-apply the wallpaper.
 */
export function useFocalBackgroundAutoRefresh(): void {
  useEffect(() => {
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      // Soft-fail: transient fetch errors retry next tick; also prevents an
      // unhandled rejection when the async chain outlives a jsdom teardown.
      maybeRefreshFocal().catch((err: unknown) => {
        console.warn("[theme] focal background auto-refresh tick failed", err);
      });
    };

    tick();
    const id = window.setInterval(tick, POLL_MS);

    const onVisibility = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}

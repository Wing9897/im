/** UI basic-calendar product mode — hide collect/analyze surfaces and the Tasks page. */

import { SIMPLE_MODE_STORAGE_KEY } from "../prefs";

export { SIMPLE_MODE_STORAGE_KEY };

/** Landing path when simple mode is on (and for redirects off hidden routes). */
export const SIMPLE_MODE_HOME = "/timeline";

/** Full-product default home (monitor wall). */
export const FULL_MODE_HOME = "/monitor";

/** Sidebar / deep-link prefixes that disappear in simple mode (Tasks stays in full mode). */
export const SIMPLE_MODE_HIDDEN_PREFIXES = [
  "/monitor",
  "/leaderboard",
  "/intelligence",
  "/sources",
  "/tasks",
] as const;

/** Legacy analysis-strategy URL (now a redirect to Tasks scheduling). */
export const SIMPLE_MODE_HIDDEN_AI_TABS = ["/ai/analysis-strategy"] as const;

export function readSimpleMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(SIMPLE_MODE_STORAGE_KEY);
    if (raw === null) return false;
    return JSON.parse(raw) === true;
  } catch {
    return false;
  }
}

export function writeSimpleMode(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SIMPLE_MODE_STORAGE_KEY, JSON.stringify(enabled));
  } catch {
    // ignore quota / private mode
  }
}

export function homePathForMode(simpleMode: boolean): string {
  return simpleMode ? SIMPLE_MODE_HOME : FULL_MODE_HOME;
}

export function isSimpleModeHiddenPath(pathname: string): boolean {
  return SIMPLE_MODE_HIDDEN_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function isSimpleModeHiddenAiTab(pathname: string): boolean {
  return SIMPLE_MODE_HIDDEN_AI_TABS.some(
    (tab) => pathname === tab || pathname.startsWith(`${tab}/`),
  );
}

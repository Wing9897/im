/** UI "simple calendar" product mode — hide collect / analyze surfaces. */

export const SIMPLE_MODE_STORAGE_KEY = "im:ui:simple-mode";

/** Landing path when simple mode is on (and for redirects off hidden routes). */
export const SIMPLE_MODE_HOME = "/timeline";

/** Full-product default home (monitor wall). */
export const FULL_MODE_HOME = "/monitor";

/**
 * Sidebar / deep-link prefixes that disappear in simple mode.
 * `/wall` redirects to monitor and is treated the same.
 */
export const SIMPLE_MODE_HIDDEN_PREFIXES = [
  "/monitor",
  "/wall",
  "/leaderboard",
  "/intelligence",
  "/accounts",
] as const;

/** AI workspace tabs that only matter for analysis pipelines. */
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

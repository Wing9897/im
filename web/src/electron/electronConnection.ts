/**
 * Desktop shell connection IPC (preload `window.electronConnection`).
 * No-ops safely when running in a pure browser (API absent).
 *
 * Naming map (do not invent a third vocabulary) — **single source**:
 *
 * | Layer        | Values              | Meaning                                      |
 * |--------------|---------------------|----------------------------------------------|
 * | Desktop JSON | `host` / `client`   | Sidecar+localhost UI vs thin remote shell    |
 * | Web UI store | `local` / `remote`  | Wizard / resolveBaseUrl connection mode      |
 *
 * Mapping: Desktop `host` ↔ Web `local`; Desktop `client` ↔ Web `remote`.
 *
 * All Desktop↔Web store sync goes through this module. App / Wizard must not
 * call `resetToLocalConnectionDefaults` directly (avoids racing host boot).
 */

import {
  clearConnection,
  getAccessToken,
  normalizeBaseUrl,
  resetToLocalConnectionDefaults,
  setConnectionMode,
  setServerBaseUrl,
  subscribeConnection,
  type ConnectionMode,
} from "../domain/connection/connectionStore";
import { getAppLocale, onAppLocaleChange } from "../i18n/locale";

export type DesktopConnectionMode = "host" | "client";

export interface DesktopConnectionConfig {
  mode: DesktopConnectionMode;
  /** Remote origin when mode is `client` (e.g. http://192.168.1.10:18820). */
  serverUrl?: string;
}

export interface ElectronConnectionApi {
  getConnection: () => Promise<DesktopConnectionConfig>;
  setConnection: (config: DesktopConnectionConfig) => Promise<DesktopConnectionConfig>;
  restartShell: () => Promise<{ ok: true }>;
  /** Push device access token for main-process notification SSE (null pauses). */
  setNotificationAuth?: (token: string | null) => void;
  /** Push UI locale for native notification copy. */
  setNotificationLocale?: (locale: string) => void;
}

declare global {
  interface Window {
    electronConnection?: ElectronConnectionApi;
  }
}

export function getElectronConnection(): ElectronConnectionApi | undefined {
  return typeof window !== "undefined" ? window.electronConnection : undefined;
}

/** Desktop `host|client` → Web `local|remote`. */
export function desktopModeToWeb(mode: DesktopConnectionMode): ConnectionMode {
  return mode === "host" ? "local" : "remote";
}

/** Web `local|remote` → Desktop `host|client`. */
export function webModeToDesktop(mode: ConnectionMode): DesktopConnectionMode {
  return mode === "local" ? "host" : "client";
}

/** Sole path that resets the Web store to host-origin (local) defaults. */
function applyWebStoreForHost(): void {
  resetToLocalConnectionDefaults();
}

/** Sole path that writes Web store for an already-live remote origin. */
function applyWebStoreForClient(serverUrl: string): void {
  setConnectionMode(desktopModeToWeb("client"));
  setServerBaseUrl(serverUrl);
}

/**
 * Apply local (host) Web connection defaults.
 * Browser bootstrap / local pair after Desktop host is confirmed.
 */
export function applyLocalWebConnectionDefaults(): void {
  applyWebStoreForHost();
}

/**
 * Apply remote Web connection for a normalized server URL.
 * Browser pair / advanced login when Desktop IPC is absent.
 */
export function applyRemoteWebConnection(serverUrl: string): void {
  const normalized = normalizeBaseUrl(serverUrl);
  if (!normalized) return;
  applyWebStoreForClient(normalized);
}

const BOOT_SYNC_ATTEMPTS = 3;
const BOOT_SYNC_RETRY_MS = 50;

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Desktop boot: if shell is host, clear stale remote baseUrl on this origin.
 * App must call this instead of `resetToLocalConnectionDefaults`.
 * Retries IPC briefly, then throws — callers must surface the error (do not
 * leave a poisoned remote baseUrl and treat host as silently unavailable).
 */
export async function syncDesktopConnectionOnBoot(): Promise<void> {
  const api = getElectronConnection();
  if (!api) return;
  let lastError: unknown;
  for (let attempt = 1; attempt <= BOOT_SYNC_ATTEMPTS; attempt += 1) {
    try {
      const cfg = await api.getConnection();
      if (cfg.mode === "host") {
        applyWebStoreForHost();
      }
      return;
    } catch (error) {
      lastError = error;
      if (attempt < BOOT_SYNC_ATTEMPTS) {
        await delay(BOOT_SYNC_RETRY_MS);
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(
        typeof lastError === "string" ? lastError : "Desktop connection sync failed",
      );
}

/**
 * Ensure Desktop shell is host (sidecar + localhost UI).
 * Also corrects the web store to `local` + empty custom base (host origin).
 * @returns true if `restartShell` was invoked (caller should stop — page will reload).
 * @throws when IPC fails (caller should surface the error; do not treat as success).
 */
export async function ensureDesktopHostMode(): Promise<boolean> {
  const api = getElectronConnection();
  if (!api) {
    applyWebStoreForHost();
    return false;
  }
  const current = await api.getConnection();
  if (current.mode === "host") {
    await api.setConnection({ mode: "host" });
    applyWebStoreForHost();
    return false;
  }
  await api.setConnection({ mode: webModeToDesktop("local") });
  // Do not mutate remote tokens on the old origin; shell reload clears context.
  await api.restartShell();
  return true;
}

/**
 * Ensure Desktop shell is client for the given remote URL.
 * Does **not** write Web `im:connection` on the host origin — tokens must land
 * after restart on the remote origin.
 * @returns true if `restartShell` was invoked (caller should stop — page will reload).
 * @throws when IPC fails.
 */
export async function ensureDesktopClientMode(serverUrl: string): Promise<boolean> {
  const api = getElectronConnection();
  if (!api) return false;
  const normalized = normalizeBaseUrl(serverUrl);
  if (!normalized) return false;
  const current = await api.getConnection();
  const currentUrl = normalizeBaseUrl(current.serverUrl) ?? "";
  if (current.mode === "client" && currentUrl === normalized) {
    applyWebStoreForClient(normalized);
    return false;
  }
  await api.setConnection({
    mode: webModeToDesktop("remote"),
    serverUrl: normalized,
  });
  await api.restartShell();
  return true;
}

/**
 * Push the current device access token to Desktop main-process notification SSE.
 * No-op in browser. Call on boot-ready and whenever ``im:connection`` changes.
 */
export function syncDesktopNotificationAuth(): void {
  const api = getElectronConnection();
  if (!api?.setNotificationAuth) return;
  api.setNotificationAuth(getAccessToken() ?? null);
}

/** Keep Desktop notification SSE auth in sync with the Web connection store. */
export function subscribeDesktopNotificationAuth(): () => void {
  const api = getElectronConnection();
  if (!api?.setNotificationAuth) return () => {};
  syncDesktopNotificationAuth();
  return subscribeConnection(() => {
    syncDesktopNotificationAuth();
  });
}

/**
 * Push the current UI locale to Desktop main-process notification copy.
 * No-op in browser.
 */
export function syncDesktopNotificationLocale(locale?: string): void {
  const api = getElectronConnection();
  if (!api?.setNotificationLocale) return;
  api.setNotificationLocale(locale ?? getAppLocale());
}

/** Keep Desktop notification locale in sync with UI language changes. */
export function subscribeDesktopNotificationLocale(): () => void {
  const api = getElectronConnection();
  if (!api?.setNotificationLocale) return () => {};
  syncDesktopNotificationLocale();
  return onAppLocaleChange((locale) => {
    syncDesktopNotificationLocale(locale);
  });
}

/**
 * After Profile logout on a Desktop client: reset to host so first-run can
 * choose Local again (or Remote after the host shell is back).
 */
export async function resetDesktopConnectionAfterLogout(): Promise<void> {
  const api = getElectronConnection();
  if (!api) {
    applyWebStoreForHost();
    return;
  }
  const current = await api.getConnection();
  if (current.mode === "host") {
    applyWebStoreForHost();
    return;
  }
  await api.setConnection({ mode: webModeToDesktop("local") });
  await api.restartShell();
}

/**
 * After a destructive full reset (`POST /system/reset/database`): clear client auth +
 * caches, force Desktop back to host, and relaunch (or reload the browser)
 * so boot runs FirstRunWizard against the empty admin table.
 *
 * `localStorage.clear()` alone is not enough — connectionStore keeps tokens
 * in memory, and `/system/restart` only SIGTERMs the sidecar (renderer stays).
 */
export async function relaunchAfterDestructiveReset(): Promise<void> {
  try {
    window.localStorage.clear();
    window.sessionStorage.clear();
  } catch {
    /* ignore quota / private-mode */
  }
  clearConnection();

  const api = getElectronConnection();
  if (!api) {
    window.location.reload();
    return;
  }

  const current = await api.getConnection();
  if (current.mode !== "host") {
    await api.setConnection({ mode: "host" });
  } else {
    applyWebStoreForHost();
  }
  await api.restartShell();
}

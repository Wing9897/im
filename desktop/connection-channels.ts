/**
 * IPC channel names for desktop connection settings.
 * Preload must keep an identical self-contained copy (sandboxed preload
 * cannot require sibling modules) — see preload-channels.test.ts.
 */
export const CONNECTION_CHANNELS = {
  getConnection: 'connection:get',
  setConnection: 'connection:set',
  restartShell: 'connection:restart-shell',
  /** Renderer → main: device access token for notification SSE (or null to pause). */
  setNotificationAuth: 'connection:set-notification-auth',
  /** Renderer → main: UI locale for native notification copy. */
  setNotificationLocale: 'connection:set-notification-locale',
  /** Renderer → main: stored UI locale preference (`auto` or a concrete locale). */
  setUiLocalePreference: 'connection:set-ui-locale-preference',
  /** Main → renderer: apply UI locale preference from the tray. */
  applyUiLocalePreference: 'connection:apply-ui-locale-preference',
  /** Renderer → main: drain a locale preference queued before the UI subscribed. */
  getPendingUiLocalePreference: 'connection:get-pending-ui-locale-preference',
  /** Renderer → main: analysis tray snapshot (paused + whether writes are allowed). */
  setAnalysisTrayState: 'connection:set-analysis-tray-state',
  /** Main → renderer: pause / resume / emergency abort from the tray. */
  applyAnalysisTrayCommand: 'connection:apply-analysis-tray-command',
} as const;

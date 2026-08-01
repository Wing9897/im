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
} as const;

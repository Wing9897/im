import { contextBridge, ipcRenderer } from 'electron';

// Keep preload self-contained — sandboxed preload cannot require sibling modules.
const WINDOW_CONTROLS_CHANNELS = {
  getState: 'window-controls:get-state',
  minimize: 'window-controls:minimize',
  toggleMaximize: 'window-controls:toggle-maximize',
  close: 'window-controls:close',
  maximizedChanged: 'window-controls:maximized-changed',
} as const;

const CONNECTION_CHANNELS = {
  getConnection: 'connection:get',
  setConnection: 'connection:set',
  restartShell: 'connection:restart-shell',
  setNotificationAuth: 'connection:set-notification-auth',
  setNotificationLocale: 'connection:set-notification-locale',
} as const;

const CALENDAR_IMPORT_CHANNELS = {
  getPending: 'calendar-import:get-pending',
  onImport: 'calendar-import:event',
} as const;

type CalendarImportPayload = {
  content: string;
  sourceId: string;
  source: 'file' | 'url' | 'deeplink';
  sourceLabel: string;
};

type CalendarImportMessage =
  | { ok: true; payload: CalendarImportPayload }
  | { ok: false; error: string; sourceLabel?: string };

contextBridge.exposeInMainWorld('electronWindow', {
  isDesktopShell: true as const,
  getState: () =>
    ipcRenderer.invoke(WINDOW_CONTROLS_CHANNELS.getState) as Promise<{ isMaximized: boolean }>,
  minimize: () => ipcRenderer.send(WINDOW_CONTROLS_CHANNELS.minimize),
  toggleMaximize: () => ipcRenderer.send(WINDOW_CONTROLS_CHANNELS.toggleMaximize),
  close: () => ipcRenderer.send(WINDOW_CONTROLS_CHANNELS.close),
  onMaximizedChange: (callback: (isMaximized: boolean) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, isMaximized: boolean) => {
      callback(isMaximized);
    };
    ipcRenderer.on(WINDOW_CONTROLS_CHANNELS.maximizedChanged, listener);
    return () => ipcRenderer.removeListener(WINDOW_CONTROLS_CHANNELS.maximizedChanged, listener);
  },
});

/** Minimal IPC for FirstRunWizard / Profile to switch host vs client. */
contextBridge.exposeInMainWorld('electronConnection', {
  getConnection: () =>
    ipcRenderer.invoke(CONNECTION_CHANNELS.getConnection) as Promise<{
      mode: 'host' | 'client';
      serverUrl?: string;
    }>,
  setConnection: (config: { mode: 'host' | 'client'; serverUrl?: string }) =>
    ipcRenderer.invoke(CONNECTION_CHANNELS.setConnection, config) as Promise<{
      mode: 'host' | 'client';
      serverUrl?: string;
    }>,
  restartShell: () =>
    ipcRenderer.invoke(CONNECTION_CHANNELS.restartShell) as Promise<{ ok: true }>,
  /** Push device access token for main-process analysis notifications SSE. */
  setNotificationAuth: (token: string | null) =>
    ipcRenderer.send(CONNECTION_CHANNELS.setNotificationAuth, token),
  /** Push UI locale for native analysis notification copy. */
  setNotificationLocale: (locale: string) =>
    ipcRenderer.send(CONNECTION_CHANNELS.setNotificationLocale, locale),
});

/** .ics / intelligencemonitor://calendar/import → calendar import wizard. */
contextBridge.exposeInMainWorld('electronCalendarImport', {
  getPending: () =>
    ipcRenderer.invoke(CALENDAR_IMPORT_CHANNELS.getPending) as Promise<CalendarImportMessage | null>,
  onImport: (callback: (message: CalendarImportMessage) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, message: CalendarImportMessage) => {
      callback(message);
    };
    ipcRenderer.on(CALENDAR_IMPORT_CHANNELS.onImport, listener);
    return () => ipcRenderer.removeListener(CALENDAR_IMPORT_CHANNELS.onImport, listener);
  },
});

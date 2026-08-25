import { app, ipcMain, type BrowserWindow, type IpcMainEvent } from 'electron';
import { CONNECTION_CHANNELS } from './connection-channels';
import {
  loadConnection,
  saveConnection,
  type ConnectionConfig,
} from './connection';
import { setAnalysisNotificationAuth, setAnalysisNotificationLocale } from './notifications';
import {
  isShellLocalePreference,
  type ShellLocalePreference,
} from './shell-i18n';

export type AnalysisTrayCommand = 'pause' | 'resume' | 'abort';

export type AnalysisTrayState = {
  paused: boolean;
  enabled: boolean;
};

export type TrayIpcSinks = {
  onUiLocalePreference?: (pref: ShellLocalePreference) => void;
  onAnalysisTrayState?: (state: AnalysisTrayState) => void;
};

let ipcRegistered = false;
let shellWindow: BrowserWindow | null = null;
let pendingLocalePref: ShellLocalePreference | null = null;
let traySinks: TrayIpcSinks = {};

export function setConnectionIpcShellWindow(win: BrowserWindow | null): void {
  shellWindow = win;
}

export function setTrayIpcSinks(sinks: TrayIpcSinks): void {
  traySinks = sinks;
}

function sendToShell(channel: string, payload: unknown): boolean {
  const win = shellWindow;
  if (!win) return false;
  try {
    if (typeof win.isDestroyed === 'function' && win.isDestroyed()) return false;
    const contents = win.webContents;
    if (
      !contents ||
      (typeof contents.isDestroyed === 'function' && contents.isDestroyed())
    ) {
      return false;
    }
    contents.send(channel, payload);
    return true;
  } catch {
    return false;
  }
}

/** Queue + push a locale preference so the renderer can hot-swap the Web UI. */
export function requestRendererLocalePreference(pref: ShellLocalePreference): void {
  pendingLocalePref = pref;
  sendToShell(CONNECTION_CHANNELS.applyUiLocalePreference, pref);
}

/**
 * Push an analysis command to the renderer. No-ops when the window is gone
 * (tray items stay disabled until the renderer reports write-capable state).
 */
export function requestRendererAnalysisCommand(command: AnalysisTrayCommand): void {
  sendToShell(CONNECTION_CHANNELS.applyAnalysisTrayCommand, command);
}

function takePendingLocalePreference(): ShellLocalePreference | null {
  const current = pendingLocalePref;
  pendingLocalePref = null;
  return current;
}

/**
 * Register connection IPC once.
 * `restartShell` relaunches the Electron process so host↔client can
 * start/stop the sidecar cleanly.
 */
export function registerConnectionIpc(getUserDataPath: () => string): void {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.handle(CONNECTION_CHANNELS.getConnection, () => {
    return loadConnection(getUserDataPath());
  });

  ipcMain.handle(
    CONNECTION_CHANNELS.setConnection,
    (_event, config: ConnectionConfig) => {
      return saveConnection(getUserDataPath(), config);
    },
  );

  ipcMain.handle(CONNECTION_CHANNELS.restartShell, () => {
    app.relaunch();
    app.quit();
    return { ok: true as const };
  });

  ipcMain.handle(CONNECTION_CHANNELS.getPendingUiLocalePreference, () => {
    return takePendingLocalePreference();
  });

  ipcMain.on(
    CONNECTION_CHANNELS.setNotificationAuth,
    (_event: IpcMainEvent, token: unknown) => {
      setAnalysisNotificationAuth(typeof token === 'string' ? token : null);
    },
  );

  ipcMain.on(
    CONNECTION_CHANNELS.setNotificationLocale,
    (_event: IpcMainEvent, locale: unknown) => {
      setAnalysisNotificationLocale(typeof locale === 'string' ? locale : null);
    },
  );

  ipcMain.on(
    CONNECTION_CHANNELS.setUiLocalePreference,
    (_event: IpcMainEvent, preference: unknown) => {
      if (!isShellLocalePreference(preference)) return;
      traySinks.onUiLocalePreference?.(preference);
    },
  );

  ipcMain.on(
    CONNECTION_CHANNELS.setAnalysisTrayState,
    (_event: IpcMainEvent, state: unknown) => {
      const raw = state && typeof state === 'object' ? (state as Record<string, unknown>) : null;
      traySinks.onAnalysisTrayState?.({
        paused: Boolean(raw?.paused),
        enabled: Boolean(raw?.enabled),
      });
    },
  );
}

export function unregisterConnectionIpc(): void {
  if (!ipcRegistered) return;
  ipcRegistered = false;
  ipcMain.removeHandler(CONNECTION_CHANNELS.getConnection);
  ipcMain.removeHandler(CONNECTION_CHANNELS.setConnection);
  ipcMain.removeHandler(CONNECTION_CHANNELS.restartShell);
  ipcMain.removeHandler(CONNECTION_CHANNELS.getPendingUiLocalePreference);
  ipcMain.removeAllListeners(CONNECTION_CHANNELS.setNotificationAuth);
  ipcMain.removeAllListeners(CONNECTION_CHANNELS.setNotificationLocale);
  ipcMain.removeAllListeners(CONNECTION_CHANNELS.setUiLocalePreference);
  ipcMain.removeAllListeners(CONNECTION_CHANNELS.setAnalysisTrayState);
  shellWindow = null;
  pendingLocalePref = null;
  traySinks = {};
}

import { app, ipcMain, type IpcMainEvent } from 'electron';
import { CONNECTION_CHANNELS } from './connection-channels';
import {
  loadConnection,
  saveConnection,
  type ConnectionConfig,
} from './connection';
import { setAnalysisNotificationAuth, setAnalysisNotificationLocale } from './notifications';

let ipcRegistered = false;

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
}

export function unregisterConnectionIpc(): void {
  if (!ipcRegistered) return;
  ipcRegistered = false;
  ipcMain.removeHandler(CONNECTION_CHANNELS.getConnection);
  ipcMain.removeHandler(CONNECTION_CHANNELS.setConnection);
  ipcMain.removeHandler(CONNECTION_CHANNELS.restartShell);
  ipcMain.removeAllListeners(CONNECTION_CHANNELS.setNotificationAuth);
  ipcMain.removeAllListeners(CONNECTION_CHANNELS.setNotificationLocale);
}

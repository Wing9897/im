import { BrowserWindow, ipcMain, type IpcMainEvent, type IpcMainInvokeEvent } from 'electron';
import { WINDOW_CONTROLS_CHANNELS } from './window-controls-channels';

export { WINDOW_CONTROLS_CHANNELS } from './window-controls-channels';

let ipcRegistered = false;

function windowFromEvent(
  event: IpcMainInvokeEvent | IpcMainEvent,
): BrowserWindow | null {
  return BrowserWindow.fromWebContents(event.sender);
}

function bindMaximizedEvents(win: BrowserWindow): void {
  const notifyMaximized = () => {
    if (win.isDestroyed()) return;
    win.webContents.send(
      WINDOW_CONTROLS_CHANNELS.maximizedChanged,
      win.isMaximized(),
    );
  };

  win.on('maximize', notifyMaximized);
  win.on('unmaximize', notifyMaximized);
}

/**
 * Register IPC once (sender → window), then bind maximize events for `win`.
 * Safe to call for every BrowserWindow (main + viewer children).
 */
export function registerWindowControls(win: BrowserWindow): void {
  if (!ipcRegistered) {
    ipcRegistered = true;

    ipcMain.handle(WINDOW_CONTROLS_CHANNELS.getState, (event) => {
      const target = windowFromEvent(event);
      return { isMaximized: target?.isMaximized() ?? false };
    });

    ipcMain.on(WINDOW_CONTROLS_CHANNELS.minimize, (event) => {
      windowFromEvent(event)?.minimize();
    });

    ipcMain.on(WINDOW_CONTROLS_CHANNELS.toggleMaximize, (event) => {
      const target = windowFromEvent(event);
      if (!target) return;
      if (target.isMaximized()) {
        target.unmaximize();
      } else {
        target.maximize();
      }
    });

    ipcMain.on(WINDOW_CONTROLS_CHANNELS.close, (event) => {
      windowFromEvent(event)?.close();
    });
  }

  bindMaximizedEvents(win);
}

export function unregisterWindowControls(): void {
  if (!ipcRegistered) return;
  ipcRegistered = false;
  ipcMain.removeHandler(WINDOW_CONTROLS_CHANNELS.getState);
  ipcMain.removeAllListeners(WINDOW_CONTROLS_CHANNELS.minimize);
  ipcMain.removeAllListeners(WINDOW_CONTROLS_CHANNELS.toggleMaximize);
  ipcMain.removeAllListeners(WINDOW_CONTROLS_CHANNELS.close);
}

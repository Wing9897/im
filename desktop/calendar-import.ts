/**
 * Desktop calendar import: .ics file association + intelligencemonitor:// deep link.
 *
 * Main process safely reads / fetches ICS and delivers its original content to
 * the renderer (queued until the shell is ready). RFC 5545 parsing stays server-side.
 *
 * Split for maintainability (zero behavior change):
 * - calendar-import-remote.ts — SSRF / remote fetch
 * - calendar-import-protocol.ts — argv / protocol / local file messages
 */

import { app, ipcMain, type BrowserWindow } from 'electron';
import * as path from 'node:path';
import {
  CALENDAR_IMPORT_CHANNELS,
  CALENDAR_IMPORT_PROTOCOL,
} from './calendar-import-channels';
import {
  extractImportTargetsFromArgv,
  isCalendarImportProtocolUrl,
  isIcsFileArg,
  messageFromIcsFile,
  messageFromIcsText,
  messageFromProtocolUrl,
  type CalendarImportMessage,
  type CalendarImportPayload,
} from './calendar-import-protocol';
import {
  fetchRemoteIcsText,
  isDisallowedRemoteAddress,
  type RemoteIcsFetchOptions,
} from './calendar-import-remote';

export type { CalendarImportMessage, CalendarImportPayload, RemoteIcsFetchOptions };
export {
  extractImportTargetsFromArgv,
  fetchRemoteIcsText,
  isCalendarImportProtocolUrl,
  isDisallowedRemoteAddress,
  isIcsFileArg,
  messageFromIcsFile,
  messageFromIcsText,
  messageFromProtocolUrl,
};

const PROTOCOL = CALENDAR_IMPORT_PROTOCOL;

let mainWindowRef: BrowserWindow | null = null;
let pending: CalendarImportMessage | null = null;
let ipcRegistered = false;

export function setCalendarImportMainWindow(win: BrowserWindow | null): void {
  mainWindowRef = win;
}

function deliver(message: CalendarImportMessage): void {
  pending = message;
  const win = mainWindowRef;
  if (!win) return;
  try {
    if (typeof win.isDestroyed === 'function' && win.isDestroyed()) return;
    if (!win.webContents || (typeof win.webContents.isDestroyed === 'function' && win.webContents.isDestroyed())) {
      return;
    }
    win.webContents.send(CALENDAR_IMPORT_CHANNELS.onImport, message);
  } catch {
    // Keep pending for getPending drain.
  }
}

export function focusMainWindow(): void {
  const win = mainWindowRef;
  if (!win) return;
  try {
    if (typeof win.isDestroyed === 'function' && win.isDestroyed()) return;
    if (typeof win.isMinimized === 'function' && win.isMinimized()) {
      win.restore();
    }
    win.show();
    win.focus();
  } catch {
    // Window may already be gone during shutdown.
  }
}

export async function handleImportTargets(targets: {
  protocolUrl: string | null;
  icsPath: string | null;
}): Promise<void> {
  if (targets.icsPath) {
    deliver(messageFromIcsFile(targets.icsPath));
    focusMainWindow();
    return;
  }
  if (targets.protocolUrl) {
    const message = await messageFromProtocolUrl(targets.protocolUrl);
    deliver(message);
    focusMainWindow();
  }
}

export function registerCalendarImportProtocolClient(devMode: boolean): void {
  if (devMode) {
    // Development: electron.exe + app path
    const appPath = path.resolve(process.argv[1] || '.');
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [appPath]);
  } else {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }
}

export function registerCalendarImportIpc(): void {
  if (ipcRegistered) return;
  ipcRegistered = true;
  ipcMain.handle(CALENDAR_IMPORT_CHANNELS.getPending, () => {
    const current = pending;
    pending = null;
    return current;
  });
}

export function unregisterCalendarImportIpc(): void {
  if (!ipcRegistered) return;
  ipcRegistered = false;
  ipcMain.removeHandler(CALENDAR_IMPORT_CHANNELS.getPending);
}

/** Register macOS open-file / open-url before app ready. */
export function registerCalendarImportOsHandlers(): void {
  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    if (isIcsFileArg(filePath)) {
      void handleImportTargets({ protocolUrl: null, icsPath: path.resolve(filePath) });
    }
  });
  app.on('open-url', (event, url) => {
    event.preventDefault();
    if (isCalendarImportProtocolUrl(url)) {
      void handleImportTargets({ protocolUrl: url, icsPath: null });
    }
  });
}

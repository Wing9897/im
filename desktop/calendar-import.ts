/**
 * Desktop calendar import: .ics file association + intelligencemonitor:// deep link.
 *
 * Main process reads / fetches ICS, parses the first VEVENT, and delivers a draft
 * to the renderer (queued until the shell is ready).
 */

import { app, ipcMain, type BrowserWindow } from 'electron';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as https from 'node:https';
import * as path from 'node:path';
import { URL } from 'node:url';
import {
  CALENDAR_IMPORT_CHANNELS,
  CALENDAR_IMPORT_PROTOCOL,
} from './calendar-import-channels';
import { MAX_ICS_CHARS, parseIcsText } from './ics-parse';

export type CalendarImportDraft = {
  title: string;
  startTime: string;
  endTime: string;
  location: string;
  body: string;
  /** Optional owning task id from deep link; empty → UI default `__user__`. */
  taskId: string;
  source: 'file' | 'url' | 'deeplink';
  sourceLabel: string;
};

export type CalendarImportMessage =
  | { ok: true; draft: CalendarImportDraft }
  | { ok: false; error: string; sourceLabel?: string };

const PROTOCOL = CALENDAR_IMPORT_PROTOCOL;
const FETCH_TIMEOUT_MS = 20_000;

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

/** True when argv token looks like our custom protocol URL. */
export function isCalendarImportProtocolUrl(value: string): boolean {
  return value.toLowerCase().startsWith(`${PROTOCOL}://`);
}

/** True when argv token is a local .ics path (existing or extension-only for cold start). */
export function isIcsFileArg(value: string): boolean {
  const cleaned = stripQuotes(value);
  if (!cleaned.toLowerCase().endsWith('.ics')) return false;
  // Reject URLs that happen to end in .ics
  if (/^[a-z][a-z0-9+.-]*:/i.test(cleaned) && !/^[a-zA-Z]:[\\/]/.test(cleaned)) {
    return false;
  }
  return true;
}

function stripQuotes(value: string): string {
  const t = value.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1);
  }
  return t;
}

/**
 * Extract protocol URL and/or .ics path from process / second-instance argv.
 * Skips electron/exe and known flags.
 */
export function extractImportTargetsFromArgv(argv: readonly string[] | null | undefined): {
  protocolUrl: string | null;
  icsPath: string | null;
} {
  let protocolUrl: string | null = null;
  let icsPath: string | null = null;
  for (const raw of argv ?? []) {
    if (!raw || raw === '--dev' || raw.startsWith('-')) continue;
    // Skip the electron binary / app entry script
    const base = path.basename(raw).toLowerCase();
    if (base === 'electron' || base === 'electron.exe') continue;
    if (base === 'main.js' || base.endsWith('.asar')) continue;

    if (isCalendarImportProtocolUrl(raw)) {
      protocolUrl = raw;
      continue;
    }
    if (isIcsFileArg(raw)) {
      icsPath = path.resolve(stripQuotes(raw));
    }
  }
  return { protocolUrl, icsPath };
}

function draftFromParsed(
  parsed: NonNullable<ReturnType<typeof parseIcsText>>,
  source: CalendarImportDraft['source'],
  sourceLabel: string,
  taskId = '',
): CalendarImportDraft {
  return {
    title: parsed.title,
    startTime: parsed.startTime,
    endTime: parsed.endTime,
    location: parsed.location,
    body: parsed.body,
    taskId,
    source,
    sourceLabel,
  };
}

export function messageFromIcsText(
  text: string,
  source: CalendarImportDraft['source'],
  sourceLabel: string,
  taskId = '',
): CalendarImportMessage {
  try {
    const parsed = parseIcsText(text);
    if (!parsed) {
      return { ok: false, error: 'No usable VEVENT found in ICS', sourceLabel };
    }
    return { ok: true, draft: draftFromParsed(parsed, source, sourceLabel, taskId) };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message, sourceLabel };
  }
}

export function messageFromIcsFile(filePath: string): CalendarImportMessage {
  const label = path.basename(filePath);
  try {
    if (!fs.existsSync(filePath)) {
      return { ok: false, error: `File not found: ${label}`, sourceLabel: label };
    }
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return { ok: false, error: `Not a file: ${label}`, sourceLabel: label };
    }
    if (stat.size > MAX_ICS_CHARS) {
      return { ok: false, error: 'ICS file is too large', sourceLabel: label };
    }
    const text = fs.readFileSync(filePath, 'utf8');
    return messageFromIcsText(text, 'file', label);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message, sourceLabel: label };
  }
}

function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      reject(new Error('Invalid URL'));
      return;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      reject(new Error('Only http(s) URLs are allowed'));
      return;
    }
    const lib = parsed.protocol === 'https:' ? https : http;
    const req = lib.get(
      url,
      {
        timeout: FETCH_TIMEOUT_MS,
        headers: { Accept: 'text/calendar, text/plain, */*' },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          // One hop redirect
          void fetchText(new URL(res.headers.location, url).toString())
            .then(resolve)
            .catch(reject);
          return;
        }
        if (status < 200 || status >= 300) {
          res.resume();
          reject(new Error(`HTTP ${status}`));
          return;
        }
        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', (chunk: Buffer) => {
          total += chunk.length;
          if (total > MAX_ICS_CHARS) {
            req.destroy();
            reject(new Error('ICS payload is too large'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          resolve(Buffer.concat(chunks).toString('utf8'));
        });
      },
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Download timed out'));
    });
    req.on('error', reject);
  });
}

/**
 * Parse intelligencemonitor://calendar/import?... deep links.
 *
 * Supported query keys:
 * - url — remote ICS (http/https); app fetches
 * - title, start, end, location, body, taskId — inline draft (no ICS)
 */
export async function messageFromProtocolUrl(rawUrl: string): Promise<CalendarImportMessage> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, error: 'Invalid deep link', sourceLabel: rawUrl };
  }
  if (url.protocol.toLowerCase() !== `${PROTOCOL}:`) {
    return { ok: false, error: 'Unsupported protocol', sourceLabel: rawUrl };
  }

  // Host may be "calendar" with path "/import", or path-only "//calendar/import"
  const hostPath = `${url.hostname}${url.pathname}`.replace(/\/+/g, '/').toLowerCase();
  if (!hostPath.includes('calendar') || !hostPath.includes('import')) {
    return {
      ok: false,
      error: 'Unknown deep link path (expected calendar/import)',
      sourceLabel: rawUrl,
    };
  }

  const params = url.searchParams;
  const remote = (params.get('url') || '').trim();
  if (remote) {
    try {
      const text = await fetchText(remote);
      return messageFromIcsText(text, 'url', remote);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message, sourceLabel: remote };
    }
  }

  const title = (params.get('title') || '').trim();
  const start = (params.get('start') || '').trim();
  if (!title || !start) {
    return {
      ok: false,
      error: 'Deep link needs url=… or title+start',
      sourceLabel: rawUrl,
    };
  }

  return {
    ok: true,
    draft: {
      title,
      startTime: start,
      endTime: (params.get('end') || '').trim(),
      location: (params.get('location') || '').trim(),
      body: (params.get('body') || '').trim(),
      taskId: (params.get('taskId') || '').trim(),
      source: 'deeplink',
      sourceLabel: rawUrl,
    },
  };
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

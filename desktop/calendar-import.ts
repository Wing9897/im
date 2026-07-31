/**
 * Desktop calendar import: .ics file association + intelligencemonitor:// deep link.
 *
 * Main process safely reads / fetches ICS and delivers its original content to
 * the renderer (queued until the shell is ready). RFC 5545 parsing stays server-side.
 */

import { app, ipcMain, type BrowserWindow } from 'electron';
import { lookup as dnsLookup } from 'node:dns/promises';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as https from 'node:https';
import { isIP } from 'node:net';
import * as path from 'node:path';
import { URL } from 'node:url';
import {
  CALENDAR_IMPORT_CHANNELS,
  CALENDAR_IMPORT_PROTOCOL,
} from './calendar-import-channels';
import { decodeIcsBytes, MAX_ICS_BYTES, validateIcsContent } from './ics-parse';

export type CalendarImportPayload = {
  content: string;
  /** Stable backend idempotency namespace; not a filename or URL. */
  sourceId: string;
  source: 'file' | 'url' | 'deeplink';
  sourceLabel: string;
};

export type CalendarImportMessage =
  | { ok: true; payload: CalendarImportPayload }
  | { ok: false; error: string; sourceLabel?: string };

const PROTOCOL = CALENDAR_IMPORT_PROTOCOL;
const FETCH_TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 3;

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

function payloadFromContent(
  content: string,
  source: CalendarImportPayload['source'],
  sourceLabel: string,
): CalendarImportPayload {
  return {
    content: validateIcsContent(content),
    sourceId: 'ics',
    source,
    sourceLabel,
  };
}

export function messageFromIcsText(
  text: string,
  source: CalendarImportPayload['source'],
  sourceLabel: string,
): CalendarImportMessage {
  try {
    return { ok: true, payload: payloadFromContent(text, source, sourceLabel) };
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
    if (stat.size > MAX_ICS_BYTES) {
      return { ok: false, error: 'ICS file is too large', sourceLabel: label };
    }
    const text = decodeIcsBytes(fs.readFileSync(filePath));
    return messageFromIcsText(text, 'file', label);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message, sourceLabel: label };
  }
}

type ResolvedRemoteTarget = {
  address: string;
  family: 4 | 6;
  url: URL;
};

type HttpGet = (
  options: https.RequestOptions,
  callback: (response: http.IncomingMessage) => void,
) => http.ClientRequest;

export type RemoteIcsFetchOptions = {
  httpGet?: HttpGet;
  httpsGet?: HttpGet;
  timeoutMs?: number;
};

function ipv4Parts(address: string): number[] | null {
  if (isIP(address) !== 4) return null;
  const parts = address.split('.').map(Number);
  return parts.length === 4 ? parts : null;
}

function ipv6Words(address: string): number[] | null {
  const withoutZone = address.replace(/^\[|\]$/g, '').split('%', 1)[0].toLowerCase();
  if (isIP(withoutZone) !== 6) return null;
  let normalized = withoutZone;
  const ipv4Tail = normalized.match(/(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (ipv4Tail) {
    const parts = ipv4Parts(ipv4Tail);
    if (!parts) return null;
    const replacement = `${((parts[0] << 8) | parts[1]).toString(16)}:${((parts[2] << 8) | parts[3]).toString(16)}`;
    normalized = normalized.slice(0, -ipv4Tail.length) + replacement;
  }
  const halves = normalized.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  const omitted = 8 - left.length - right.length;
  if (omitted < 0 || (halves.length === 1 && omitted !== 0)) return null;
  const words = [...left, ...Array(omitted).fill('0'), ...right].map((word) =>
    Number.parseInt(word || '0', 16),
  );
  return words.length === 8 && words.every((word) => Number.isInteger(word)) ? words : null;
}

/** Reject addresses that can target this device, its LAN, or reserved networks. */
export function isDisallowedRemoteAddress(address: string): boolean {
  const ipv4 = ipv4Parts(address);
  if (ipv4) {
    const [a, b, c] = ipv4;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) ||
      (a === 192 && b === 0 && c === 2) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }

  const words = ipv6Words(address);
  if (!words) return true;
  const allZero = words.every((word) => word === 0);
  const loopback = words.slice(0, 7).every((word) => word === 0) && words[7] === 1;
  const ipv4Mapped =
    words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff;
  const ipv4Compatible = words.slice(0, 6).every((word) => word === 0);
  if (ipv4Mapped || ipv4Compatible) {
    const mapped = `${words[6] >> 8}.${words[6] & 0xff}.${words[7] >> 8}.${words[7] & 0xff}`;
    return isDisallowedRemoteAddress(mapped);
  }
  return (
    allZero ||
    loopback ||
    (words[0] & 0xfe00) === 0xfc00 || // fc00::/7 unique-local
    (words[0] & 0xffc0) === 0xfe80 || // fe80::/10 link-local
    (words[0] & 0xff00) === 0xff00 || // multicast
    (words[0] === 0x2001 && words[1] === 0x0db8) // documentation
  );
}

async function resolveRemoteTarget(rawUrl: string): Promise<ResolvedRemoteTarget> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http(s) URLs are allowed');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Remote calendar URL must not contain credentials');
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');
  const literalFamily = isIP(hostname);
  const addresses = literalFamily
    ? [{ address: hostname, family: literalFamily }]
    : await dnsLookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isDisallowedRemoteAddress(address))) {
    throw new Error('Remote calendar URL resolves to a private or reserved address');
  }
  const selected = addresses[0];
  return {
    address: selected.address,
    family: selected.family as 4 | 6,
    url: parsed,
  };
}

export async function fetchRemoteIcsText(
  url: string,
  redirectsRemaining = MAX_REDIRECTS,
  dependencies: RemoteIcsFetchOptions = {},
): Promise<string> {
  const target = await resolveRemoteTarget(url);
  return new Promise((resolve, reject) => {
    const parsed = target.url;
    const get =
      parsed.protocol === 'https:'
        ? (dependencies.httpsGet ?? (https.get as HttpGet))
        : (dependencies.httpGet ?? (http.get as HttpGet));
    const timeoutMs = dependencies.timeoutMs ?? FETCH_TIMEOUT_MS;
    const req = get(
      {
        family: target.family,
        hostname: target.address,
        path: `${parsed.pathname}${parsed.search}`,
        port: parsed.port || undefined,
        protocol: parsed.protocol,
        servername: parsed.hostname,
        timeout: timeoutMs,
        headers: {
          Accept: 'text/calendar, text/plain, */*',
          Host: parsed.host,
        },
      },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          if (redirectsRemaining === 0) {
            reject(new Error('Too many redirects'));
            return;
          }
          void fetchRemoteIcsText(
            new URL(res.headers.location, url).toString(),
            redirectsRemaining - 1,
            dependencies,
          )
            .then(resolve)
            .catch(reject);
          return;
        }
        if (status < 200 || status >= 300) {
          res.resume();
          reject(new Error(`HTTP ${status}`));
          return;
        }
        const declaredLength = Number(res.headers['content-length']);
        if (Number.isFinite(declaredLength) && declaredLength > MAX_ICS_BYTES) {
          res.destroy();
          reject(new Error('ICS payload is too large'));
          return;
        }
        const chunks: Buffer[] = [];
        let total = 0;
        res.on('data', (chunk: Buffer) => {
          total += chunk.length;
          if (total > MAX_ICS_BYTES) {
            res.destroy();
            reject(new Error('ICS payload is too large'));
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () => {
          try {
            resolve(decodeIcsBytes(Buffer.concat(chunks)));
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    const totalTimeout = setTimeout(() => {
      req.destroy(new Error('Download timed out'));
    }, timeoutMs);
    req.on('close', () => clearTimeout(totalTimeout));
    req.on('timeout', () => {
      req.destroy(new Error('Download timed out'));
    });
    req.on('error', reject);
  });
}

/**
 * Parse intelligencemonitor://calendar/import?... deep links.
 *
 * Supported query keys:
 * - url — remote ICS (http/https); app fetches
 * - title, start, end, location, body — inline event converted to ICS content
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
      const text = await fetchRemoteIcsText(remote);
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

  const escapeText = (value: string) =>
    value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
  const toIcsDateTime = (value: string): string => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new Error('Deep link start/end must be valid date-times');
    }
    return parsed.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  };
  try {
    const end = (params.get('end') || '').trim();
    const content = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//IntelligenceMonitor//Calendar Import//EN',
      'BEGIN:VEVENT',
      `UID:deeplink-${Buffer.from(`${title}|${start}`).toString('base64url').slice(0, 80)}`,
      `SUMMARY:${escapeText(title)}`,
      `DTSTART:${toIcsDateTime(start)}`,
      ...(end ? [`DTEND:${toIcsDateTime(end)}`] : []),
      ...((params.get('location') || '').trim()
        ? [`LOCATION:${escapeText((params.get('location') || '').trim())}`]
        : []),
      ...((params.get('body') || '').trim()
        ? [`DESCRIPTION:${escapeText((params.get('body') || '').trim())}`]
        : []),
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ].join('\r\n');
    return { ok: true, payload: payloadFromContent(content, 'deeplink', rawUrl) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      sourceLabel: rawUrl,
    };
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

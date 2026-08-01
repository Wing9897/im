/**
 * Argv / custom-protocol / local .ics entry parsing for calendar import.
 *
 * Remote URL fetches go through calendar-import-remote (SSRF policy unchanged).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { URL } from 'node:url';
import { CALENDAR_IMPORT_PROTOCOL } from './calendar-import-channels';
import { fetchRemoteIcsText } from './calendar-import-remote';
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

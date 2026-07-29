/**
 * Minimal iCalendar (RFC 5545) VEVENT parser for one-shot Desktop import.
 *
 * Supports SUMMARY / DESCRIPTION / LOCATION / DTSTART / DTEND (DATE and
 * DATE-TIME, with or without Z). First VEVENT wins; RRULE is ignored (user
 * confirms a single occurrence via the import dialog).
 */

export type ParsedIcsEvent = {
  title: string;
  startTime: string;
  endTime: string;
  location: string;
  body: string;
  /** Total VEVENT count in the payload (1 = only this event). */
  eventCount: number;
};

const MAX_ICS_CHARS = 1_000_000;

export function unfoldIcsLines(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const raw = normalized.split('\n');
  const lines: string[] = [];
  for (const line of raw) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && lines.length > 0) {
      lines[lines.length - 1] += line.slice(1);
    } else {
      lines.push(line);
    }
  }
  return lines;
}

function splitProperty(line: string): { name: string; params: string; value: string } | null {
  const colon = line.indexOf(':');
  if (colon <= 0) return null;
  const left = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const semi = left.indexOf(';');
  if (semi === -1) {
    return { name: left.toUpperCase(), params: '', value };
  }
  return {
    name: left.slice(0, semi).toUpperCase(),
    params: left.slice(semi + 1),
    value,
  };
}

function unescapeIcsText(value: string): string {
  return value
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function paramValue(params: string, key: string): string | null {
  const upper = params.toUpperCase();
  const needle = `${key.toUpperCase()}=`;
  const idx = upper.indexOf(needle);
  if (idx === -1) return null;
  let raw = params.slice(idx + needle.length);
  if (raw.startsWith('"')) {
    const end = raw.indexOf('"', 1);
    return end === -1 ? raw.slice(1) : raw.slice(1, end);
  }
  const amp = raw.search(/[;:]/);
  if (amp !== -1) raw = raw.slice(0, amp);
  return raw;
}

/** Convert ICS date / date-time into an ISO-8601 string (UTC Z when known). */
export function icsDateToIso(value: string, params: string): string | null {
  const cleaned = value.trim();
  if (!cleaned) return null;
  const isDateOnly =
    paramValue(params, 'VALUE')?.toUpperCase() === 'DATE' || /^\d{8}$/.test(cleaned);

  if (isDateOnly) {
    const m = /^(\d{4})(\d{2})(\d{2})$/.exec(cleaned);
    if (!m) return null;
    // All-day: local midnight as a wall-clock instant (no Z) — dialog shows local.
    return `${m[1]}-${m[2]}-${m[3]}T00:00:00`;
  }

  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?$/i.exec(cleaned);
  if (!m) return null;
  const iso = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
  if (m[7]) return `${iso}Z`;
  // Floating / TZID: keep as naive local wall time for the datetime-local form.
  return iso;
}

type VEventProps = {
  summary?: string;
  description?: string;
  location?: string;
  dtstart?: { value: string; params: string };
  dtend?: { value: string; params: string };
};

function collectVEvents(lines: string[]): VEventProps[] {
  const events: VEventProps[] = [];
  let current: VEventProps | null = null;

  for (const line of lines) {
    const upper = line.toUpperCase();
    if (upper === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (upper === 'END:VEVENT') {
      if (current) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;
    const prop = splitProperty(line);
    if (!prop) continue;
    switch (prop.name) {
      case 'SUMMARY':
        current.summary = unescapeIcsText(prop.value);
        break;
      case 'DESCRIPTION':
        current.description = unescapeIcsText(prop.value);
        break;
      case 'LOCATION':
        current.location = unescapeIcsText(prop.value);
        break;
      case 'DTSTART':
        current.dtstart = { value: prop.value.trim(), params: prop.params };
        break;
      case 'DTEND':
        current.dtend = { value: prop.value.trim(), params: prop.params };
        break;
      default:
        break;
    }
  }
  return events;
}

/**
 * Parse ICS text into a single importable event draft.
 * Returns null when no usable VEVENT / DTSTART is present.
 */
export function parseIcsText(text: string): ParsedIcsEvent | null {
  if (text.length > MAX_ICS_CHARS) {
    throw new Error(`ICS payload exceeds ${MAX_ICS_CHARS} characters`);
  }
  const events = collectVEvents(unfoldIcsLines(text));
  if (events.length === 0) return null;

  const first = events[0];
  if (!first.dtstart) return null;
  const startTime = icsDateToIso(first.dtstart.value, first.dtstart.params);
  if (!startTime) return null;

  let endTime = '';
  if (first.dtend) {
    endTime = icsDateToIso(first.dtend.value, first.dtend.params) ?? '';
  }

  let body = first.description?.trim() ?? '';
  if (events.length > 1) {
    const note = `(+${events.length - 1} more event(s) in file — only the first was imported)`;
    body = body ? `${body}\n\n${note}` : note;
  }

  return {
    title: (first.summary ?? '').trim() || 'Untitled event',
    startTime,
    endTime,
    location: first.location?.trim() ?? '',
    body,
    eventCount: events.length,
  };
}

export { MAX_ICS_CHARS };

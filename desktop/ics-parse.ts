/**
 * Desktop intentionally does not parse RFC 5545 business fields.
 *
 * It only bounds and decodes the payload before sending the original content
 * to the renderer. The server owns VEVENT, timezone and recurrence parsing.
 */

/** Must stay aligned with server/calendar/ics.py. */
export const MAX_ICS_BYTES = 2 * 1024 * 1024;

export function decodeIcsBytes(bytes: Uint8Array): string {
  if (bytes.byteLength > MAX_ICS_BYTES) {
    throw new Error(`ICS content exceeds the ${MAX_ICS_BYTES}-byte limit`);
  }
  let content: string;
  try {
    content = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('ICS content is not valid UTF-8');
  }
  return validateIcsContent(content);
}

export function validateIcsContent(content: string): string {
  if (Buffer.byteLength(content, 'utf8') > MAX_ICS_BYTES) {
    throw new Error(`ICS content exceeds the ${MAX_ICS_BYTES}-byte limit`);
  }
  if (!content.trim()) {
    throw new Error('ICS content is empty');
  }
  if (content.includes('\0')) {
    throw new Error('ICS content contains NUL bytes');
  }
  return content;
}

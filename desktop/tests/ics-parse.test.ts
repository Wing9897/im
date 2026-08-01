import { describe, expect, it } from 'vitest';
import { decodeIcsBytes, MAX_ICS_BYTES, validateIcsContent } from '../ics-parse';

describe('ics-parse', () => {
  it('returns original UTF-8 content without parsing or normalizing it', () => {
    const content = 'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:你好\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
    expect(decodeIcsBytes(Buffer.from(content, 'utf8'))).toBe(content);
  });

  it('rejects invalid UTF-8', () => {
    expect(() => decodeIcsBytes(Uint8Array.from([0xc3, 0x28]))).toThrow('valid UTF-8');
  });

  it('rejects empty and NUL-bearing payloads', () => {
    expect(() => validateIcsContent(' \r\n')).toThrow('empty');
    expect(() => validateIcsContent('BEGIN:VCALENDAR\0END:VCALENDAR')).toThrow('NUL');
  });

  it('enforces the server-aligned byte limit', () => {
    expect(() => decodeIcsBytes(new Uint8Array(MAX_ICS_BYTES + 1))).toThrow('byte limit');
  });
});

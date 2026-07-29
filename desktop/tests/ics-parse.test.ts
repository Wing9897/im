import { describe, expect, it } from 'vitest';
import { icsDateToIso, parseIcsText, unfoldIcsLines } from '../ics-parse';

describe('ics-parse', () => {
  it('unfolds folded lines', () => {
    const lines = unfoldIcsLines('SUMMARY:Hello\r\n  World\r\nLOCATION:Room');
    expect(lines).toEqual(['SUMMARY:Hello World', 'LOCATION:Room']);
  });

  it('parses UTC DATE-TIME', () => {
    expect(icsDateToIso('20260729T100000Z', '')).toBe('2026-07-29T10:00:00Z');
  });

  it('parses floating DATE-TIME and DATE', () => {
    expect(icsDateToIso('20260729T100000', '')).toBe('2026-07-29T10:00:00');
    expect(icsDateToIso('20260729', 'VALUE=DATE')).toBe('2026-07-29T00:00:00');
  });

  it('parses a minimal VEVENT', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:Standup',
      'DTSTART:20260729T090000Z',
      'DTEND:20260729T093000Z',
      'LOCATION:Zoom',
      'DESCRIPTION:Daily sync\\nBring notes',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');
    const parsed = parseIcsText(ics);
    expect(parsed).toEqual({
      title: 'Standup',
      startTime: '2026-07-29T09:00:00Z',
      endTime: '2026-07-29T09:30:00Z',
      location: 'Zoom',
      body: 'Daily sync\nBring notes',
      eventCount: 1,
    });
  });

  it('keeps first VEVENT and notes extras', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'SUMMARY:First',
      'DTSTART:20260729T090000Z',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'SUMMARY:Second',
      'DTSTART:20260730T090000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n');
    const parsed = parseIcsText(ics);
    expect(parsed?.title).toBe('First');
    expect(parsed?.eventCount).toBe(2);
    expect(parsed?.body).toContain('more event');
  });

  it('returns null without VEVENT', () => {
    expect(parseIcsText('BEGIN:VCALENDAR\nEND:VCALENDAR')).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import {
  extractImportTargetsFromArgv,
  isCalendarImportProtocolUrl,
  isIcsFileArg,
  messageFromIcsText,
  messageFromProtocolUrl,
} from '../calendar-import';

describe('calendar-import argv / protocol', () => {
  it('detects protocol and ics args', () => {
    expect(isCalendarImportProtocolUrl('intelligencemonitor://calendar/import?title=a&start=b')).toBe(
      true,
    );
    expect(isIcsFileArg('C:\\tmp\\meet.ics')).toBe(true);
    expect(isIcsFileArg('https://example.com/meet.ics')).toBe(false);
  });

  it('extracts targets from argv', () => {
    const targets = extractImportTargetsFromArgv([
      'C:\\Program Files\\Electron\\electron.exe',
      'C:\\app\\main.js',
      '--dev',
      'D:\\inbox\\event.ics',
    ]);
    expect(targets.icsPath?.toLowerCase().endsWith('event.ics')).toBe(true);
    expect(targets.protocolUrl).toBeNull();
  });

  it('parses inline deep link draft', async () => {
    const message = await messageFromProtocolUrl(
      'intelligencemonitor://calendar/import?title=Meet&start=2026-07-29T10:00:00Z&end=2026-07-29T11:00:00Z&location=A&body=Hi&taskId=task-1',
    );
    expect(message.ok).toBe(true);
    if (!message.ok) return;
    expect(message.draft.title).toBe('Meet');
    expect(message.draft.taskId).toBe('task-1');
    expect(message.draft.source).toBe('deeplink');
  });

  it('rejects deep link without url or title+start', async () => {
    const message = await messageFromProtocolUrl('intelligencemonitor://calendar/import');
    expect(message.ok).toBe(false);
  });

  it('builds draft from ICS text', () => {
    const message = messageFromIcsText(
      'BEGIN:VEVENT\nSUMMARY:X\nDTSTART:20260729T120000Z\nEND:VEVENT\n',
      'file',
      'x.ics',
    );
    expect(message.ok).toBe(true);
    if (!message.ok) return;
    expect(message.draft.title).toBe('X');
    expect(message.draft.source).toBe('file');
  });
});

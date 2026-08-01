import { EventEmitter } from 'node:events';
import type { ClientRequest, IncomingMessage } from 'node:http';
import { PassThrough } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import {
  extractImportTargetsFromArgv,
  fetchRemoteIcsText,
  isDisallowedRemoteAddress,
  isCalendarImportProtocolUrl,
  isIcsFileArg,
  messageFromIcsText,
  messageFromProtocolUrl,
  type RemoteIcsFetchOptions,
} from '../calendar-import';

type HttpGet = NonNullable<RemoteIcsFetchOptions['httpGet']>;

function fakeRequest(): ClientRequest {
  const request = new EventEmitter() as ClientRequest;
  request.destroy = ((error?: Error) => {
    queueMicrotask(() => {
      if (error) request.emit('error', error);
      request.emit('close');
    });
    return request;
  }) as ClientRequest['destroy'];
  return request;
}

function fakeResponse(
  statusCode: number,
  headers: IncomingMessage['headers'],
): IncomingMessage {
  const response = new PassThrough() as unknown as IncomingMessage;
  response.statusCode = statusCode;
  response.headers = headers;
  return response;
}

describe('calendar-import argv / protocol', () => {
  it.each([
    {
      value: 'intelligencemonitor://calendar/import?title=a&start=b',
      protocol: true,
      icsFile: false,
    },
    { value: 'C:\\tmp\\meet.ics', protocol: false, icsFile: true },
    { value: 'https://example.com/meet.ics', protocol: false, icsFile: false },
  ])('classifies $value', ({ value, protocol, icsFile }) => {
    expect(isCalendarImportProtocolUrl(value)).toBe(protocol);
    expect(isIcsFileArg(value)).toBe(icsFile);
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
      'intelligencemonitor://calendar/import?title=Meet&start=2026-07-29T10:00:00Z&end=2026-07-29T11:00:00Z&location=A&body=Hi&worksetId=ws-1',
    );
    expect(message.ok).toBe(true);
    if (!message.ok) return;
    expect(message.payload.content).toContain('SUMMARY:Meet');
    expect(message.payload.content).toContain('DTSTART:20260729T100000Z');
    expect(message.payload.source).toBe('deeplink');
    expect(message.payload.sourceId).toBe('ics');
  });

  it('rejects deep link without url or title+start', async () => {
    const message = await messageFromProtocolUrl('intelligencemonitor://calendar/import');
    expect(message.ok).toBe(false);
  });

  it('forwards original ICS text without reducing it to one event', () => {
    const content =
      'BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nSUMMARY:X\r\nDTSTART:20260729T120000Z\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n';
    const message = messageFromIcsText(content, 'file', 'x.ics');
    expect(message.ok).toBe(true);
    if (!message.ok) return;
    expect(message.payload.content).toBe(content);
    expect(message.payload.source).toBe('file');
  });
});

describe('calendar-import remote SSRF / fetch', () => {
  it.each([
    ['127.0.0.1', true],
    ['10.1.2.3', true],
    ['172.16.0.1', true],
    ['192.168.1.10', true],
    ['169.254.169.254', true],
    ['::1', true],
    ['fe80::1', true],
    ['fc00::1', true],
    ['::ffff:127.0.0.1', true],
    ['8.8.8.8', false],
    ['2606:4700:4700::1111', false],
  ] as const)('isDisallowedRemoteAddress(%s) → %s', (address, disallowed) => {
    expect(isDisallowedRemoteAddress(address)).toBe(disallowed);
  });

  it('blocks loopback remote deep links', async () => {
    const loopback = encodeURIComponent('http://127.0.0.1/calendar.ics');
    const message = await messageFromProtocolUrl(
      `intelligencemonitor://calendar/import?url=${loopback}`,
    );
    expect(message).toMatchObject({
      ok: false,
      error: 'Remote calendar URL resolves to a private or reserved address',
    });
  });

  it('rejects credential-bearing remote calendar URLs before download', async () => {
    const remote = encodeURIComponent('https://user:secret@example.com/calendar.ics');
    const message = await messageFromProtocolUrl(
      `intelligencemonitor://calendar/import?url=${remote}`,
    );
    expect(message).toMatchObject({
      ok: false,
      error: 'Remote calendar URL must not contain credentials',
    });
  });

  it('revalidates a redirect before making the next request', async () => {
    const httpGet = vi.fn<HttpGet>((_options, callback) => {
      const request = fakeRequest();
      const response = fakeResponse(302, {
        location: 'http://169.254.169.254/latest/meta-data',
      });
      queueMicrotask(() => {
        callback(response);
        request.emit('close');
      });
      return request;
    });

    await expect(
      fetchRemoteIcsText('http://8.8.8.8/calendar.ics', 3, {
        httpGet,
        timeoutMs: 100,
      }),
    ).rejects.toThrow('private or reserved address');
    expect(httpGet).toHaveBeenCalledTimes(1);
  });

  it('enforces declared remote size and total timeout', async () => {
    const oversizedGet = vi.fn<HttpGet>((_options, callback) => {
      const request = fakeRequest();
      const response = fakeResponse(200, { 'content-length': String(2 * 1024 * 1024 + 1) });
      queueMicrotask(() => {
        callback(response);
        request.emit('close');
      });
      return request;
    });
    await expect(
      fetchRemoteIcsText('http://8.8.8.8/large.ics', 3, {
        httpGet: oversizedGet,
        timeoutMs: 100,
      }),
    ).rejects.toThrow('too large');

    const timeoutGet = vi.fn<HttpGet>(() => fakeRequest());
    await expect(
      fetchRemoteIcsText('http://8.8.8.8/slow.ics', 3, {
        httpGet: timeoutGet,
        timeoutMs: 5,
      }),
    ).rejects.toThrow('Download timed out');
  });
});

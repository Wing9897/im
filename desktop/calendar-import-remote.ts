/**
 * Remote ICS fetch with SSRF guards (DNS / private ranges / redirects).
 *
 * Security policy must stay aligned with calendar-import entry handling —
 * do not loosen address checks, credential rejection, size limits, or redirect revalidation.
 */

import { lookup as dnsLookup } from 'node:dns/promises';
import * as http from 'node:http';
import * as https from 'node:https';
import { isIP } from 'node:net';
import { URL } from 'node:url';
import { decodeIcsBytes, MAX_ICS_BYTES } from './ics-parse';

const FETCH_TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 3;

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

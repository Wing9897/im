/**
 * Guard: desktop DEFAULT_SERVER_PORT must stay in lockstep with
 * server/constants.py SERVICE_PORT (and the Node scripts mirror).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SERVER_PORT, DEFAULT_VITE_DEV_PORT, defaultServerBaseUrl } from '../ports';

function parsePythonServicePort(source: string): number {
  const match = source.match(/^SERVICE_PORT\s*=\s*(\d+)\s*$/m);
  if (!match) {
    throw new Error('SERVICE_PORT not found in server/constants.py');
  }
  return Number(match[1]);
}

function parseMjsServicePort(source: string): number {
  const match = source.match(/^export const SERVICE_PORT\s*=\s*(\d+)\s*;\s*$/m);
  if (!match) {
    throw new Error('SERVICE_PORT not found in scripts/service-ports.mjs');
  }
  return Number(match[1]);
}

describe('DEFAULT_SERVER_PORT desktop↔server drift', () => {
  it('matches server/constants.py and scripts/service-ports.mjs', () => {
    const pyPath = resolve(__dirname, '../../server/constants.py');
    const mjsPath = resolve(__dirname, '../../scripts/service-ports.mjs');
    const pyPort = parsePythonServicePort(readFileSync(pyPath, 'utf8'));
    const mjsPort = parseMjsServicePort(readFileSync(mjsPath, 'utf8'));
    expect(pyPort).toBe(18820);
    expect(DEFAULT_SERVER_PORT).toBe(pyPort);
    expect(mjsPort).toBe(pyPort);
    expect(DEFAULT_VITE_DEV_PORT).toBe(1420);
    expect(defaultServerBaseUrl()).toBe(`http://localhost:${pyPort}`);
  });
});

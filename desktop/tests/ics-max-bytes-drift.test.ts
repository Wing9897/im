/**
 * Guard: desktop MAX_ICS_BYTES must stay byte-identical to server/calendar/ics.py.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MAX_ICS_BYTES } from '../ics-parse';

function parsePythonMaxIcsBytes(source: string): number {
  const match = source.match(/^MAX_ICS_BYTES\s*=\s*(.+)$/m);
  if (!match) {
    throw new Error('MAX_ICS_BYTES not found in server/calendar/ics.py');
  }
  const expr = match[1].trim();
  // Accept plain int or a product of integers (e.g. `2 * 1024 * 1024`).
  const factors = expr.split('*').map((part) => part.trim());
  if (factors.length === 0 || !factors.every((part) => /^\d+$/.test(part))) {
    throw new Error(`Unexpected MAX_ICS_BYTES expression: ${expr}`);
  }
  return factors.reduce((product, factor) => product * Number(factor), 1);
}

describe('MAX_ICS_BYTES desktop↔server drift', () => {
  it('matches server/calendar/ics.py', () => {
    const pyPath = resolve(__dirname, '../../server/calendar/ics.py');
    const pySource = readFileSync(pyPath, 'utf8');
    const serverBytes = parsePythonMaxIcsBytes(pySource);
    expect(serverBytes).toBe(2 * 1024 * 1024);
    expect(MAX_ICS_BYTES).toBe(serverBytes);
  });
});

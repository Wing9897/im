import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { WINDOW_CONTROLS_CHANNELS } from '../window-controls-channels';
import { CONNECTION_CHANNELS } from '../connection-channels';
import { CALENDAR_IMPORT_CHANNELS } from '../calendar-import-channels';

function readPreloadConstObject(constName: string): Record<string, string> {
  const preloadPath = fileURLToPath(new URL('../preload.ts', import.meta.url));
  const source = readFileSync(preloadPath, 'utf8');
  const objectBody = source.match(
    new RegExp(`const ${constName} = \\{([\\s\\S]*?)\\} as const;`),
  )?.[1];

  if (!objectBody) {
    throw new Error(`preload.ts must declare self-contained ${constName}`);
  }

  return Object.fromEntries(
    [...objectBody.matchAll(/(\w+):\s*'([^']+)'/g)].map((match) => [
      match[1],
      match[2],
    ]),
  );
}

describe('preload IPC channel contracts', () => {
  it('window-control channels stay consistent with main-process map', () => {
    expect(readPreloadConstObject('WINDOW_CONTROLS_CHANNELS')).toEqual(
      WINDOW_CONTROLS_CHANNELS,
    );
  });

  it('connection channels stay consistent with main-process map', () => {
    expect(readPreloadConstObject('CONNECTION_CHANNELS')).toEqual(
      CONNECTION_CHANNELS,
    );
  });

  it('calendar-import channels stay consistent with main-process map', () => {
    expect(readPreloadConstObject('CALENDAR_IMPORT_CHANNELS')).toEqual(
      CALENDAR_IMPORT_CHANNELS,
    );
  });
});

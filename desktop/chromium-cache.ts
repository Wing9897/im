/**
 * Recover from Chromium blockfile HTTP-cache corruption
 * (``Critical error found -8`` / ``No file for a…`` / ``Failed to save user data``).
 *
 * Deleting Cache / Code Cache / GPUCache before the first BrowserWindow is safe;
 * Chromium recreates them on demand. We only wipe when the generation stamp
 * changes (one-shot per release) or when ``IM_CLEAR_ELECTRON_CACHE=1``.
 */

import * as fs from 'fs';
import * as path from 'path';

/** Bump to force a one-time cache wipe for existing installs. */
export const CHROMIUM_CACHE_GENERATION = '1';

const CACHE_DIR_NAMES = [
  'Cache',
  'Code Cache',
  'GPUCache',
  'DawnCache',
  'DawnGraphiteCache',
  'DawnWebGPUCache',
] as const;

export function chromiumCacheGenerationPath(userDataPath: string): string {
  return path.join(userDataPath, 'im-chromium-cache-generation');
}

export function clearChromiumDiskCaches(userDataPath: string): string[] {
  const removed: string[] = [];
  for (const name of CACHE_DIR_NAMES) {
    const dir = path.join(userDataPath, name);
    try {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
        removed.push(name);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[chromium-cache] Failed to remove ${name}: ${message}`);
    }
  }
  return removed;
}

/**
 * @returns which cache dirs were removed (empty if nothing done).
 */
export function maybeRecoverChromiumDiskCache(userDataPath: string): string[] {
  const force = process.env.IM_CLEAR_ELECTRON_CACHE === '1';
  const genPath = chromiumCacheGenerationPath(userDataPath);
  let current = '';
  try {
    current = fs.readFileSync(genPath, 'utf8').trim();
  } catch {
    current = '';
  }

  if (!force && current === CHROMIUM_CACHE_GENERATION) {
    return [];
  }

  const removed = clearChromiumDiskCaches(userDataPath);
  try {
    fs.mkdirSync(userDataPath, { recursive: true });
    fs.writeFileSync(genPath, CHROMIUM_CACHE_GENERATION, 'utf8');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[chromium-cache] Failed to write generation stamp: ${message}`);
  }

  if (removed.length > 0 || force) {
    console.info(
      `[chromium-cache] Reset Chromium disk cache (generation=${CHROMIUM_CACHE_GENERATION}` +
        `${force ? ', forced' : ''}${removed.length ? `, removed=${removed.join(',')}` : ''})`,
    );
  }
  return removed;
}

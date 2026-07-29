import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  CHROMIUM_CACHE_GENERATION,
  clearChromiumDiskCaches,
  chromiumCacheGenerationPath,
  maybeRecoverChromiumDiskCache,
} from '../chromium-cache';

describe('chromium-cache', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'im-chromium-cache-'));
    delete process.env.IM_CLEAR_ELECTRON_CACHE;
  });

  afterEach(() => {
    delete process.env.IM_CLEAR_ELECTRON_CACHE;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('clearChromiumDiskCaches removes known cache dirs', () => {
    fs.mkdirSync(path.join(tmp, 'Cache'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'Code Cache'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'Cache', 'index'), 'x');

    const removed = clearChromiumDiskCaches(tmp);

    expect(removed).toEqual(expect.arrayContaining(['Cache', 'Code Cache']));
    expect(fs.existsSync(path.join(tmp, 'Cache'))).toBe(false);
    expect(fs.existsSync(path.join(tmp, 'Code Cache'))).toBe(false);
  });

  it('maybeRecover clears once then no-ops on matching generation', () => {
    fs.mkdirSync(path.join(tmp, 'Cache'), { recursive: true });

    const first = maybeRecoverChromiumDiskCache(tmp);
    expect(first).toContain('Cache');
    expect(fs.readFileSync(chromiumCacheGenerationPath(tmp), 'utf8')).toBe(
      CHROMIUM_CACHE_GENERATION,
    );

    fs.mkdirSync(path.join(tmp, 'Cache'), { recursive: true });
    const second = maybeRecoverChromiumDiskCache(tmp);
    expect(second).toEqual([]);
    expect(fs.existsSync(path.join(tmp, 'Cache'))).toBe(true);
  });

  it('IM_CLEAR_ELECTRON_CACHE=1 forces another wipe', () => {
    fs.writeFileSync(chromiumCacheGenerationPath(tmp), CHROMIUM_CACHE_GENERATION);
    fs.mkdirSync(path.join(tmp, 'GPUCache'), { recursive: true });
    process.env.IM_CLEAR_ELECTRON_CACHE = '1';

    const removed = maybeRecoverChromiumDiskCache(tmp);
    expect(removed).toContain('GPUCache');
    expect(fs.existsSync(path.join(tmp, 'GPUCache'))).toBe(false);
  });
});

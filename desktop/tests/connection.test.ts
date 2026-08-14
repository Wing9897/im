import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  connectionFilePath,
  loadConnection,
  normalizeConnection,
  resolveNotificationServerUrl,
  resolveShellLoadUrl,
  saveConnection,
  withDesktopQuery,
} from '../connection';

describe('connection helpers', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'im-connection-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('normalizeConnection', () => {
    it('defaults to host', () => {
      expect(normalizeConnection(null)).toEqual({ mode: 'host' });
      expect(normalizeConnection({})).toEqual({ mode: 'host' });
      expect(normalizeConnection({ mode: 'host' })).toEqual({ mode: 'host' });
    });

    it('accepts client with serverUrl', () => {
      expect(
        normalizeConnection({
          mode: 'client',
          serverUrl: 'http://192.168.1.10:18820/',
        }),
      ).toEqual({ mode: 'client', serverUrl: 'http://192.168.1.10:18820' });
    });

    it('falls back to host when client lacks serverUrl', () => {
      expect(normalizeConnection({ mode: 'client' })).toEqual({ mode: 'host' });
    });

    it('falls back to host when client serverUrl is not http(s)', () => {
      expect(
        normalizeConnection({
          mode: 'client',
          serverUrl: 'file:///tmp/x',
        }),
      ).toEqual({ mode: 'host' });
      expect(
        normalizeConnection({
          mode: 'client',
          serverUrl: 'ftp://example.com',
        }),
      ).toEqual({ mode: 'host' });
    });

    it('ignores legacy allowLanAccess and does not persist it', () => {
      expect(
        normalizeConnection({ mode: 'host', allowLanAccess: true }),
      ).toEqual({ mode: 'host' });
      fs.writeFileSync(
        connectionFilePath(tmpDir),
        JSON.stringify({ mode: 'host', allowLanAccess: true }, null, 2),
        'utf8',
      );
      expect(loadConnection(tmpDir)).toEqual({ mode: 'host' });
      const saved = saveConnection(tmpDir, { mode: 'host' });
      expect(saved).toEqual({ mode: 'host' });
      expect(JSON.parse(fs.readFileSync(connectionFilePath(tmpDir), 'utf8'))).toEqual({
        mode: 'host',
      });
    });
  });

  describe('load/save', () => {
    it('returns host default when file is missing', () => {
      expect(loadConnection(tmpDir)).toEqual({ mode: 'host' });
    });

    it('round-trips client config', () => {
      const saved = saveConnection(tmpDir, {
        mode: 'client',
        serverUrl: 'http://10.0.0.2:18820',
      });
      expect(saved).toEqual({
        mode: 'client',
        serverUrl: 'http://10.0.0.2:18820',
      });
      expect(fs.existsSync(connectionFilePath(tmpDir))).toBe(true);
      expect(loadConnection(tmpDir)).toEqual(saved);
    });

    it('returns host default on corrupt JSON', () => {
      fs.writeFileSync(connectionFilePath(tmpDir), '{not-json', 'utf8');
      expect(loadConnection(tmpDir)).toEqual({ mode: 'host' });
    });

    it('preserves resetPasswordForLocal when true', () => {
      expect(
        normalizeConnection({ mode: 'host', resetPasswordForLocal: true }),
      ).toEqual({ mode: 'host', resetPasswordForLocal: true });
      const saved = saveConnection(tmpDir, {
        mode: 'host',
        resetPasswordForLocal: true,
      });
      expect(saved.resetPasswordForLocal).toBe(true);
      expect(loadConnection(tmpDir).resetPasswordForLocal).toBe(true);
    });

    it('mode-only save keeps on-disk resetPasswordForLocal armed', () => {
      saveConnection(tmpDir, { mode: 'host', resetPasswordForLocal: true });
      const saved = saveConnection(tmpDir, { mode: 'host' });
      expect(saved).toEqual({ mode: 'host', resetPasswordForLocal: true });
    });

    it('explicit false clears armed flag on save', () => {
      saveConnection(tmpDir, { mode: 'host', resetPasswordForLocal: true });
      const saved = saveConnection(tmpDir, {
        mode: 'host',
        resetPasswordForLocal: false,
      });
      expect(saved).toEqual({ mode: 'host' });
      expect(loadConnection(tmpDir).resetPasswordForLocal).toBeUndefined();
    });
  });

  describe('resolveShellLoadUrl / notifications', () => {
    const ports = { serverPort: 18820, viteDevPort: 1420 };

    it('host prod uses localhost server port', () => {
      expect(
        resolveShellLoadUrl({ mode: 'host' }, { ...ports, devMode: false }),
      ).toBe('http://localhost:18820/?desktop=1');
    });

    it('host dev uses Vite port', () => {
      expect(
        resolveShellLoadUrl({ mode: 'host' }, { ...ports, devMode: true }),
      ).toBe('http://localhost:1420/?desktop=1');
    });

    it('client uses remote serverUrl with desktop=1', () => {
      expect(
        resolveShellLoadUrl(
          { mode: 'client', serverUrl: 'http://192.168.1.5:18820' },
          { ...ports, devMode: false },
        ),
      ).toBe('http://192.168.1.5:18820/?desktop=1');
    });

    it('notification URL follows client origin', () => {
      expect(
        resolveNotificationServerUrl(
          { mode: 'client', serverUrl: 'http://192.168.1.5:18820/app' },
          18820,
        ),
      ).toBe('http://192.168.1.5:18820');
      expect(resolveNotificationServerUrl({ mode: 'host' }, 18820)).toBe(
        'http://localhost:18820',
      );
    });

    it('withDesktopQuery is idempotent', () => {
      expect(withDesktopQuery('http://localhost:18820/?desktop=1')).toBe(
        'http://localhost:18820/?desktop=1',
      );
    });
  });
});

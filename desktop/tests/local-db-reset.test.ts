import { mkdtempSync, writeFileSync, mkdirSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { describe, expect, it, afterEach } from 'vitest';
import {
  backupThenResetDesktopDb,
  desktopDbPath,
  listDesktopDbTargets,
} from '../local-db-reset';

const temps: string[] = [];

function makeDataDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'im-db-reset-'));
  temps.push(dir);
  return dir;
}

afterEach(() => {
  for (const dir of temps.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('local-db-reset', () => {
  it('lists db + wal/shm under the data root and dev-runtime', () => {
    const dir = path.join('tmp', 'Intelligence Monitor');
    const targets = listDesktopDbTargets(dir);
    expect(targets).toEqual([
      path.join(dir, 'intelligence_monitor.db'),
      path.join(dir, 'intelligence_monitor.db-wal'),
      path.join(dir, 'intelligence_monitor.db-shm'),
      path.join(dir, 'dev-runtime', 'intelligence_monitor.db'),
      path.join(dir, 'dev-runtime', 'intelligence_monitor.db-wal'),
      path.join(dir, 'dev-runtime', 'intelligence_monitor.db-shm'),
    ]);
  });

  it('is a no-op when no database files exist', () => {
    const dir = makeDataDir();
    const result = backupThenResetDesktopDb(dir);
    expect(result).toEqual({ ok: true, backupDir: null, deleted: [] });
    expect(existsSync(desktopDbPath(dir))).toBe(false);
  });

  it('backs up then deletes live db and sidecars, leaving secret.key', () => {
    const dir = makeDataDir();
    const db = desktopDbPath(dir);
    writeFileSync(db, 'stamp-2-bytes');
    writeFileSync(`${db}-wal`, 'wal');
    writeFileSync(`${db}-shm`, 'shm');
    writeFileSync(path.join(dir, 'secret.key'), 'keep-me');
    mkdirSync(path.join(dir, 'dev-runtime'));
    writeFileSync(path.join(dir, 'dev-runtime', 'intelligence_monitor.db'), 'dev-db');

    const now = new Date(2026, 7, 30, 14, 15, 16);
    const result = backupThenResetDesktopDb(dir, now);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected ok');
    expect(result.backupDir).toBe(path.join(dir, 'db-backup-20260830141516'));
    expect(existsSync(db)).toBe(false);
    expect(existsSync(`${db}-wal`)).toBe(false);
    expect(existsSync(`${db}-shm`)).toBe(false);
    expect(existsSync(path.join(dir, 'dev-runtime', 'intelligence_monitor.db'))).toBe(false);
    expect(readFileSync(path.join(dir, 'secret.key'), 'utf8')).toBe('keep-me');
    expect(readFileSync(path.join(result.backupDir!, 'intelligence_monitor.db'), 'utf8')).toBe(
      'stamp-2-bytes',
    );
    expect(
      readFileSync(path.join(result.backupDir!, 'dev-runtime', 'intelligence_monitor.db'), 'utf8'),
    ).toBe('dev-db');
    expect(
      readFileSync(path.join(result.backupDir!, 'intelligence_monitor.db-wal'), 'utf8'),
    ).toBe('wal');
  });
});

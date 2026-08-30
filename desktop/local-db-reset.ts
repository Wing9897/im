/**
 * Packaged-app local SQLite reset for the desktop data path.
 *
 * Mirrors ``scripts/reset_local_databases.py --apply`` for a single data root:
 * delete ``intelligence_monitor.db`` and its ``-wal``/``-shm`` sidecars
 * (plus ``dev-runtime/`` copies). Does not touch secrets, sessions, or
 * connection.json. Always copies existing files aside first.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export const DESKTOP_DB_NAME = 'intelligence_monitor.db';

export type LocalDbResetResult =
  | { ok: true; backupDir: string | null; deleted: string[] }
  | { ok: false; error: string; backupDir: string | null; deleted: string[] };

export function desktopDbPath(dataDir: string): string {
  return path.join(dataDir, DESKTOP_DB_NAME);
}

/** Known SQLite files under the desktop data root (same names as the reset script). */
export function listDesktopDbTargets(dataDir: string): string[] {
  const databases = [
    path.join(dataDir, DESKTOP_DB_NAME),
    path.join(dataDir, 'dev-runtime', DESKTOP_DB_NAME),
  ];
  return databases.flatMap((db) => [db, `${db}-wal`, `${db}-shm`]);
}

function existingTargets(dataDir: string): string[] {
  return listDesktopDbTargets(dataDir).filter((file) => {
    try {
      return fs.existsSync(file) && fs.statSync(file).isFile();
    } catch {
      return false;
    }
  });
}

function backupRelPath(dataDir: string, file: string): string {
  const relative = path.relative(dataDir, file);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    return path.basename(file);
  }
  return relative;
}

function timestampStamp(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  );
}

/**
 * Copy existing DB files into ``db-backup-<timestamp>/``, then delete the live files.
 * Never deletes backups, ``secret.key``, sessions, or ``connection.json``.
 */
export function backupThenResetDesktopDb(
  dataDir: string,
  now = new Date(),
): LocalDbResetResult {
  const targets = existingTargets(dataDir);
  if (targets.length === 0) {
    return { ok: true, backupDir: null, deleted: [] };
  }

  const backupDir = path.join(dataDir, `db-backup-${timestampStamp(now)}`);
  try {
    fs.mkdirSync(backupDir, { recursive: true });
    for (const file of targets) {
      const dest = path.join(backupDir, backupRelPath(dataDir, file));
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(file, dest);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message, backupDir, deleted: [] };
  }

  const deleted: string[] = [];
  for (const file of targets) {
    try {
      fs.unlinkSync(file);
      deleted.push(file);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message, backupDir, deleted };
    }
  }

  return { ok: true, backupDir, deleted };
}

"""File-level SQLite database backup / restore helpers (pre-migration safety)."""

from __future__ import annotations

import logging
import os
import shutil
import sqlite3
import time
from pathlib import Path

logger = logging.getLogger(__name__)

_RESTORE_RETRIES = 5
_RESTORE_DELAYS_S = (0.05, 0.1, 0.2, 0.4, 0.8)


def upgrade_baseline_path(db_path: str, from_version: int, to_version: int) -> Path:
    """Stable pre-upgrade snapshot used for auto-restore across process restarts."""
    source = Path(db_path)
    return source.with_name(f"{source.stem}.bak-v{from_version}-to-v{to_version}-baseline{source.suffix}")


def _fsync_path(path: Path) -> None:
    """Best-effort durable write for a copied backup file."""
    try:
        with open(path, "rb+") as handle:
            handle.flush()
            os.fsync(handle.fileno())
    except OSError as exc:
        logger.warning("fsync failed for %s: %s", path, exc)


def _sidecar_tmp_path(destination: Path) -> Path:
    return destination.with_name(destination.name + ".tmp")


def _atomic_copy_file(source: Path, destination: Path) -> None:
    """Copy ``source`` to ``destination`` via tmp → fsync → replace."""
    tmp = _sidecar_tmp_path(destination)
    try:
        if tmp.exists():
            tmp.unlink()
        shutil.copy2(source, tmp)
        _fsync_path(tmp)
        os.replace(tmp, destination)
    except BaseException:
        if tmp.exists():
            try:
                tmp.unlink()
            except OSError as exc:
                logger.warning("Failed to remove temp backup %s: %s", tmp, exc)
        raise


def quick_check_database(db_path: str | Path) -> bool:
    """Return True when a read-only ``PRAGMA quick_check`` reports ``ok``."""
    path = Path(db_path)
    if not path.exists() or path.stat().st_size == 0:
        return False
    uri = path.resolve().as_uri() + "?mode=ro"
    try:
        conn = sqlite3.connect(uri, uri=True, timeout=5.0)
    except sqlite3.Error as exc:
        logger.warning("quick_check open failed for %s: %s", path, exc)
        return False
    try:
        row = conn.execute("PRAGMA quick_check").fetchone()
        result = str(row[0]).lower() if row is not None else ""
        if result != "ok":
            logger.warning("quick_check failed for %s: %s", path, result)
            return False
        return True
    except sqlite3.Error as exc:
        logger.warning("quick_check error for %s: %s", path, exc)
        return False
    finally:
        conn.close()


def _remove_sqlite_sidecars(db_file: Path) -> None:
    for suffix in ("-wal", "-shm"):
        side = Path(str(db_file) + suffix)
        if side.exists():
            side.unlink()


def _atomic_copy_db_with_sidecars(source: Path, destination: Path) -> None:
    """Atomically copy main DB file and matching WAL/SHM sidecars."""
    _atomic_copy_file(source, destination)
    for suffix in ("-wal", "-shm"):
        side = Path(str(source) + suffix)
        dest_side = Path(str(destination) + suffix)
        if side.exists():
            _atomic_copy_file(side, dest_side)
        elif dest_side.exists():
            dest_side.unlink()


def backup_database_file(
    db_path: str,
    *,
    reason: str = "schema-upgrade",
    from_version: int | None = None,
    to_version: int | None = None,
    destination: str | Path | None = None,
) -> str | None:
    """Copy ``db_path`` (and WAL/SHM if present) beside the original.

    Naming (when ``destination`` is omitted):
    ``{stem}.bak-v{from}-to-v{to}-{YYYYMMDD-HHMMSS}.db`` when versions are
    provided, otherwise ``{stem}.bak-{reason}-{stamp}.db``.

    Writes go through ``*.tmp`` → fsync → ``os.replace``.

    Returns the backup ``.db`` path, or ``None`` for ``:memory:`` / missing files.
    """
    if not db_path or db_path == ":memory:":
        return None
    source = Path(db_path)
    if not source.exists():
        return None

    if destination is not None:
        backup_db = Path(destination)
    else:
        stamp = time.strftime("%Y%m%d-%H%M%S")
        if from_version is not None and to_version is not None:
            label = f"v{from_version}-to-v{to_version}-{stamp}"
        else:
            label = f"{reason}-{stamp}"
        backup_db = source.with_name(f"{source.stem}.bak-{label}{source.suffix}")
        if backup_db.exists():
            backup_db = source.with_name(f"{source.stem}.bak-{label}-{os.getpid()}{source.suffix}")

    _atomic_copy_db_with_sidecars(source, backup_db)
    logger.info("Database backup created: %s", backup_db)
    return str(backup_db)


def ensure_upgrade_baseline(
    db_path: str,
    *,
    from_version: int,
    to_version: int,
) -> str | None:
    """Create the stable upgrade baseline if missing; return its path.

    Once written, the baseline is **not** overwritten by later retries so a
    process crash after a bad mid-upgrade backup cannot replace the good
    pre-upgrade snapshot. A baseline that fails ``PRAGMA quick_check`` is
    deleted and rebuilt from the current live file.
    """
    if not db_path or db_path == ":memory:":
        return None
    baseline = upgrade_baseline_path(db_path, from_version, to_version)
    if baseline.exists():
        if quick_check_database(baseline):
            return str(baseline)
        logger.warning(
            "Upgrade baseline failed quick_check; deleting and rebuilding: %s",
            baseline,
        )
        try:
            baseline.unlink()
            _remove_sqlite_sidecars(baseline)
        except OSError as exc:
            logger.warning("Failed to remove corrupt baseline %s: %s", baseline, exc)
            return None
    return backup_database_file(
        db_path,
        from_version=from_version,
        to_version=to_version,
        destination=baseline,
    )


def find_upgrade_baseline(
    db_path: str,
    *,
    from_version: int,
    to_version: int,
) -> str | None:
    if not db_path or db_path == ":memory:":
        return None
    baseline = upgrade_baseline_path(db_path, from_version, to_version)
    return str(baseline) if baseline.exists() else None


def cleanup_old_upgrade_backups(db_path: str) -> list[str]:
    """Delete all legacy timestamped upgrade backups; never removes ``*-baseline.db``.

    Upgrades keep only the stable baseline; forensic timestamped copies are no
    longer created. Returns deleted paths.
    """
    if not db_path or db_path == ":memory:":
        return []
    source = Path(db_path)
    deleted: list[str] = []
    for path in source.parent.glob(f"{source.stem}.bak-v*-to-v*-*.db"):
        if path.name.endswith("-baseline.db") or "-baseline." in path.name:
            continue
        # Require the timestamped shape (not an unexpected sibling).
        name = path.name
        if ".bak-v" not in name or "-to-v" not in name:
            continue
        try:
            path.unlink()
            _remove_sqlite_sidecars(path)
            deleted.append(str(path))
        except OSError as exc:
            logger.warning("Failed to delete old backup %s: %s", path, exc)
    if deleted:
        logger.info("Removed %d old upgrade backup(s)", len(deleted))
    return deleted


def restore_database_from_backup(db_path: str, backup_path: str) -> None:
    """Replace ``db_path`` with ``backup_path`` (and matching WAL/SHM).

    Caller **must** close all SQLite connections to ``db_path`` first.
    The backup is first copied to a sidecar staging file and ``quick_check``'d;
    only then is the live main file replaced. Live ``-wal`` / ``-shm`` are
    removed before the final replace so a restored main file is never paired
    with a newer WAL from a failed migrate. Retries briefly on Windows
    file-lock / antivirus races.
    """
    if not db_path or db_path == ":memory:":
        raise ValueError("Cannot restore an in-memory database from a file backup")
    target = Path(db_path)
    source = Path(backup_path)
    if not source.exists():
        raise FileNotFoundError(f"Backup not found: {backup_path}")

    staging = target.with_name(f"{target.stem}.restore-staging{target.suffix}")
    last_exc: BaseException | None = None
    for attempt in range(_RESTORE_RETRIES):
        try:
            if staging.exists():
                staging.unlink()
            _remove_sqlite_sidecars(staging)

            # Stage main + sidecars under the staging name so quick_check sees
            # the same WAL pairing as the backup, without touching live yet.
            _atomic_copy_db_with_sidecars(source, staging)
            if not quick_check_database(staging):
                raise RuntimeError(f"Backup failed PRAGMA quick_check before restore: {backup_path}")

            _remove_sqlite_sidecars(target)
            os.replace(staging, target)
            _fsync_path(target)

            # Promote staged sidecars (still named *.restore-staging-wal/shm).
            for suffix in ("-wal", "-shm"):
                staged_side = Path(str(staging) + suffix)
                dest_side = Path(str(target) + suffix)
                if staged_side.exists():
                    os.replace(staged_side, dest_side)
                    _fsync_path(dest_side)
                elif dest_side.exists():
                    dest_side.unlink()

            logger.info("Database restored from backup: %s -> %s", backup_path, db_path)
            return
        except RuntimeError:
            # quick_check / validation failures are not transient — do not retry.
            if staging.exists():
                try:
                    staging.unlink()
                except OSError:
                    pass
            _remove_sqlite_sidecars(staging)
            raise
        except OSError as exc:
            last_exc = exc
            if staging.exists():
                try:
                    staging.unlink()
                except OSError:
                    pass
            _remove_sqlite_sidecars(staging)
            if attempt >= _RESTORE_RETRIES - 1:
                break
            time.sleep(_RESTORE_DELAYS_S[attempt])
    assert last_exc is not None
    raise last_exc

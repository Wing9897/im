"""Shared SQLite fixtures for schema lifecycle tests (wipe-floor + fingerprint)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import aiosqlite

from server.db.schema import DDL

_DEFAULT_LOG = ("sentinel", "2026-01-01T00:00:00Z", "info", "schema-test")


async def logical_snapshot(path: str) -> dict[str, Any]:
    """Capture persisted version, app_logs rows, and complete SQL inventory."""
    conn = await aiosqlite.connect(path)
    conn.row_factory = aiosqlite.Row
    try:
        version_cursor = await conn.execute("PRAGMA user_version")
        version_row = await version_cursor.fetchone()
        await version_cursor.close()
        rows_cursor = await conn.execute("SELECT * FROM app_logs ORDER BY id")
        rows = [dict(row) for row in await rows_cursor.fetchall()]
        await rows_cursor.close()
        schema_cursor = await conn.execute(
            "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name"
        )
        schema = [tuple(row) for row in await schema_cursor.fetchall()]
        await schema_cursor.close()
        assert version_row is not None
        return {"version": int(version_row[0]), "rows": rows, "schema": schema}
    finally:
        await conn.close()


def file_snapshot(path: str) -> dict[str, bytes]:
    """Capture the database and any SQLite sidecars exactly as persisted."""
    return {
        suffix: candidate.read_bytes() for suffix in ("", "-wal", "-shm") if (candidate := Path(path + suffix)).exists()
    }


async def stamp_user_version(path: str, version: int) -> None:
    """Set ``PRAGMA user_version`` on an existing DB file."""
    conn = await aiosqlite.connect(path)
    try:
        await conn.execute(f"PRAGMA user_version={version}")
        await conn.commit()
    finally:
        await conn.close()


async def make_existing_db(path: str, *, log_rows: list[tuple[str, str, str, str]]) -> None:
    """Create a schema-compatible database file with app_logs rows (unstamped)."""
    conn = await aiosqlite.connect(path)
    try:
        await conn.execute("PRAGMA journal_mode=WAL")
        await conn.executescript(DDL)
        for row_id, time, level, category in log_rows:
            await conn.execute(
                "INSERT INTO app_logs (id, time, level, category, kind, message) VALUES (?, ?, ?, ?, ?, ?)",
                (row_id, time, level, category, "system", f"message for {row_id}"),
            )
        await conn.commit()
    finally:
        await conn.close()


async def make_stamped_db(
    path: str,
    *,
    version: int,
    log_rows: list[tuple[str, str, str, str]] | None = None,
) -> None:
    """DDL + log rows + stamped ``user_version`` (shared by wipe-floor / newer-reject)."""
    await make_existing_db(path, log_rows=log_rows or [_DEFAULT_LOG])
    await stamp_user_version(path, version)


async def make_lookalike_db(path: str, *, version: int, defect: str) -> None:
    """Create all application tables while removing one required structure."""
    await make_existing_db(path, log_rows=[_DEFAULT_LOG])
    conn = await aiosqlite.connect(path)
    try:
        if defect == "column":
            await conn.execute("ALTER TABLE app_logs DROP COLUMN details")
        elif defect == "index":
            await conn.execute("DROP INDEX idx_app_logs_time")
        elif defect == "foreign_key":
            await conn.execute("DROP TABLE source_channels")
            await conn.execute(
                """
                CREATE TABLE source_channels (
                    source_id TEXT NOT NULL,
                    platform TEXT NOT NULL,
                    platform_id TEXT NOT NULL,
                    PRIMARY KEY (source_id, platform, platform_id),
                    FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE
                )
                """
            )
        else:
            raise ValueError(f"Unknown schema defect: {defect}")
        await conn.execute(f"PRAGMA user_version={version}")
        await conn.commit()
    finally:
        await conn.close()

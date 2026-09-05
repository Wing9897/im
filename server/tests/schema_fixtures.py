"""Shared SQLite fixtures for schema lifecycle tests (floor + migrate + fingerprint)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import aiosqlite

from server.db.schema import DDL

_DEFAULT_LOG = ("sentinel", "2026-01-01T00:00:00Z", "info", "schema-test")
_STAMP3_WORKSET_COLUMNS = ("description",)
_STAMP5_WORKSET_COLUMNS = ("cover_data_url",)
#: Stamp-6-only household auto-sync cache columns (dropped again at stamp 7).
_STAMP6_PUBLISH_COLUMNS_DDL = (
    "auto_sync INTEGER NOT NULL DEFAULT 1",
    "auto_sync_interval_seconds INTEGER NOT NULL DEFAULT 60",
)


async def _drop_workset_stamp3_columns(conn: aiosqlite.Connection) -> None:
    """Strip stamp-3 workset columns so floor/stamp-2 fixtures can walk ADD COLUMN."""
    for column in _STAMP3_WORKSET_COLUMNS:
        await conn.execute(f"ALTER TABLE worksets DROP COLUMN {column}")


async def _drop_workset_stamp5_columns(conn: aiosqlite.Connection) -> None:
    """Strip stamp-5 workset cover column so stamp-4 fixtures can walk ADD COLUMN."""
    for column in _STAMP5_WORKSET_COLUMNS:
        await conn.execute(f"ALTER TABLE worksets DROP COLUMN {column}")


async def _drop_calendar_share_publish(conn: aiosqlite.Connection) -> None:
    """Strip stamp-4 publish table so older fixtures can walk CREATE TABLE."""
    await conn.execute("DROP TABLE IF EXISTS calendar_share_publish")


async def _add_stamp6_auto_sync_columns(conn: aiosqlite.Connection) -> None:
    """Re-add the stamp-6 household auto-sync cache columns so fixtures match published v6."""
    for column_ddl in _STAMP6_PUBLISH_COLUMNS_DDL:
        await conn.execute(f"ALTER TABLE calendar_share_publish ADD COLUMN {column_ddl}")


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
    """DDL + log rows + stamped ``user_version`` (shared by floor / migrate / newer-reject)."""
    await make_existing_db(path, log_rows=log_rows or [_DEFAULT_LOG])
    await stamp_user_version(path, version)


async def make_pre_schema_meta_db(
    path: str,
    *,
    version: int,
    log_rows: list[tuple[str, str, str, str]] | None = None,
    strip_workset_stamp3: bool = True,
) -> None:
    """Current DDL minus ``schema_meta``.

    ``strip_workset_stamp3=True`` is the live stamp-1 shape (no description).
    ``False`` keeps current workset columns for a current-stamp lookalike.
    """
    await make_existing_db(path, log_rows=log_rows or [_DEFAULT_LOG])
    conn = await aiosqlite.connect(path)
    try:
        await conn.execute("DROP TABLE IF EXISTS schema_meta")
        await _drop_calendar_share_publish(conn)
        if strip_workset_stamp3:
            await _drop_workset_stamp3_columns(conn)
        await conn.execute(f"PRAGMA user_version={version}")
        await conn.commit()
    finally:
        await conn.close()


async def make_stamp_2_db(
    path: str,
    *,
    log_rows: list[tuple[str, str, str, str]] | None = None,
) -> None:
    """Stamp-2 shape: ``schema_meta`` present, workset description absent."""
    await make_existing_db(path, log_rows=log_rows or [_DEFAULT_LOG])
    conn = await aiosqlite.connect(path)
    try:
        await _drop_workset_stamp3_columns(conn)
        await _drop_calendar_share_publish(conn)
        await conn.execute("UPDATE schema_meta SET schema_semver = '1.1.0' WHERE id = 1")
        await conn.execute("PRAGMA user_version=2")
        await conn.commit()
    finally:
        await conn.close()


async def make_stamp_3_db(
    path: str,
    *,
    log_rows: list[tuple[str, str, str, str]] | None = None,
) -> None:
    """Stamp-3 shape: workset description present, publish table absent."""
    await make_existing_db(path, log_rows=log_rows or [_DEFAULT_LOG])
    conn = await aiosqlite.connect(path)
    try:
        await _drop_calendar_share_publish(conn)
        await conn.execute("UPDATE schema_meta SET schema_semver = '1.2.0' WHERE id = 1")
        await conn.execute("PRAGMA user_version=3")
        await conn.commit()
    finally:
        await conn.close()


async def make_stamp_4_db(
    path: str,
    *,
    log_rows: list[tuple[str, str, str, str]] | None = None,
) -> None:
    """Stamp-4 shape: publish table present, workset cover absent."""
    await make_existing_db(path, log_rows=log_rows or [_DEFAULT_LOG])
    conn = await aiosqlite.connect(path)
    try:
        await _drop_workset_stamp5_columns(conn)
        await conn.execute("UPDATE schema_meta SET schema_semver = '1.3.0' WHERE id = 1")
        await conn.execute("PRAGMA user_version=4")
        await conn.commit()
    finally:
        await conn.close()


async def make_stamp_5_db(
    path: str,
    *,
    log_rows: list[tuple[str, str, str, str]] | None = None,
) -> None:
    """Stamp-5 shape: current structure stamped 5 with its published semver."""
    await make_existing_db(path, log_rows=log_rows or [_DEFAULT_LOG])
    conn = await aiosqlite.connect(path)
    try:
        await conn.execute("UPDATE schema_meta SET schema_semver = '1.4.0' WHERE id = 1")
        await conn.execute("PRAGMA user_version=5")
        await conn.commit()
    finally:
        await conn.close()


async def make_stamp_6_db(
    path: str,
    *,
    log_rows: list[tuple[str, str, str, str]] | None = None,
) -> None:
    """Stamp-6 shape: publish table carries the retired household auto-sync cache columns."""
    await make_existing_db(path, log_rows=log_rows or [_DEFAULT_LOG])
    conn = await aiosqlite.connect(path)
    try:
        await _add_stamp6_auto_sync_columns(conn)
        await conn.execute("UPDATE schema_meta SET schema_semver = '1.5.0' WHERE id = 1")
        await conn.execute("PRAGMA user_version=6")
        await conn.commit()
    finally:
        await conn.close()


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

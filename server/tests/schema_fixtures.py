"""Shared SQLite fixtures for schema lifecycle and migration tests."""

from __future__ import annotations

import aiosqlite

from server.db.schema import DDL


async def make_existing_db(path: str, *, log_rows: list[tuple[str, str, str, str]]) -> None:
    """Create a schema-compatible database file with app_logs rows."""
    conn = await aiosqlite.connect(path)
    try:
        await conn.execute("PRAGMA journal_mode=WAL")
        await conn.executescript(DDL)
        for row_id, time, level, category in log_rows:
            await conn.execute(
                "INSERT INTO app_logs (id, time, level, category, message) VALUES (?, ?, ?, ?, ?)",
                (row_id, time, level, category, f"message for {row_id}"),
            )
        await conn.commit()
    finally:
        await conn.close()


async def make_lookalike_db(path: str, *, version: int, defect: str) -> None:
    """Create all application tables while removing one required structure."""
    await make_existing_db(
        path,
        log_rows=[("sentinel", "2026-01-01T00:00:00Z", "info", "schema-test")],
    )
    conn = await aiosqlite.connect(path)
    try:
        if defect == "column":
            await conn.execute("ALTER TABLE app_logs DROP COLUMN details")
        elif defect == "index":
            await conn.execute("DROP INDEX idx_app_logs_time")
        elif defect == "foreign_key":
            await conn.execute("DROP TABLE account_channels")
            await conn.execute(
                """
                CREATE TABLE account_channels (
                    account_id TEXT NOT NULL,
                    platform TEXT NOT NULL,
                    platform_id TEXT NOT NULL,
                    PRIMARY KEY (account_id, platform, platform_id),
                    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
                )
                """
            )
        else:
            raise ValueError(f"Unknown schema defect: {defect}")
        await conn.execute(f"PRAGMA user_version={version}")
        await conn.commit()
    finally:
        await conn.close()

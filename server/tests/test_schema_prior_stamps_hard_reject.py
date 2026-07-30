"""Wipe-floor stamp 3: prior stamps hard-reject (no 2→3 MigrationStep)."""

from __future__ import annotations

import aiosqlite
import pytest

from server.db.database import Database
from server.db.migrations import (
    CURRENT_SCHEMA_VERSION,
    SCHEMA_MIGRATIONS,
    SchemaEvolutionError,
    ensure_supported_schema,
)
from server.tests.schema_fixtures import make_existing_db


@pytest.mark.asyncio
async def test_prior_stamp_2_hard_rejects_without_migration(tmp_path) -> None:
    assert CURRENT_SCHEMA_VERSION == 3
    assert SCHEMA_MIGRATIONS == ()

    path = str(tmp_path / "stamp2-reject.db")
    await make_existing_db(
        path,
        log_rows=[("log-keep", "2026-01-01T00:00:00Z", "info", "schema-test")],
    )
    conn = await aiosqlite.connect(path)
    try:
        await conn.execute("PRAGMA user_version=2")
        await conn.commit()
    finally:
        await conn.close()

    db = Database(path)
    await db.connect()
    try:
        with pytest.raises(SchemaEvolutionError, match="Unsupported database schema version 2"):
            await ensure_supported_schema(db.conn)
    finally:
        await db.close()

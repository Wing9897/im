"""Fresh DDL stamps at CURRENT_SCHEMA_VERSION (wipe-floor; no 1→2 chain)."""

from __future__ import annotations

import pytest

from server.db.database import Database
from server.db.migrations import (
    CURRENT_SCHEMA_FINGERPRINT,
    CURRENT_SCHEMA_VERSION,
    SCHEMA_MIGRATIONS,
    ensure_supported_schema,
    inspect_schema,
)
from server.worksets_const import SYSTEM_WORKSET_ID


@pytest.mark.asyncio
async def test_fresh_ddl_stamps_current_with_builtin_workset(tmp_path) -> None:
    """Empty DB + ensure_supported_schema → stamp 3 + seeded __user__."""
    assert CURRENT_SCHEMA_VERSION == 3
    assert SCHEMA_MIGRATIONS == ()

    path = str(tmp_path / "fresh-stamp3.db")
    db = Database(path)
    await db.connect()
    try:
        await ensure_supported_schema(db.conn)
        fingerprint = await inspect_schema(db.conn)
        assert fingerprint.version == CURRENT_SCHEMA_VERSION
        assert fingerprint == CURRENT_SCHEMA_FINGERPRINT
        assert await db.fetch_value(
            "SELECT is_system FROM worksets WHERE id = ?", (SYSTEM_WORKSET_ID,)
        ) == 1
        # user_events.workset_id is NOT NULL with default __user__.
        async with db.conn.execute("PRAGMA table_info(user_events)") as cursor:
            cols = {str(row[1]): row for row in await cursor.fetchall()}
        workset_col = cols["workset_id"]
        assert int(workset_col[3]) == 1  # notnull
        assert workset_col[4] is not None  # dflt_value present
        assert "__user__" in str(workset_col[4])
    finally:
        await db.close()

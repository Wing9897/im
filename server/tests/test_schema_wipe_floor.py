"""Wipe-floor stamp SoT: empty registry, fresh DDL stamp, prior stamps hard-reject.

Live product baseline is ``CURRENT_SCHEMA_VERSION`` with ``SCHEMA_MIGRATIONS == ()``.
There is no 1→2→… chain; unsupported prior stamps must hard-reject without mutation.
Upgrade-gate scaffolding (fake MigrationStep injection) lives in
``test_schema_upgrade_gate.py`` and is intentionally not covered here.
"""

from __future__ import annotations

import aiosqlite
import pytest

from server.db.database import Database, SchemaBaselineError
from server.db.migrations import (
    CURRENT_SCHEMA_FINGERPRINT,
    CURRENT_SCHEMA_VERSION,
    SCHEMA_MIGRATIONS,
    ensure_supported_schema,
    inspect_schema,
    migration_pending,
)
from server.tests.schema_fixtures import file_snapshot, logical_snapshot, make_existing_db
from server.worksets_const import SYSTEM_WORKSET_ID

_HARD_REJECT_PRIOR_VERSIONS = [
    version
    for version in range(1, CURRENT_SCHEMA_VERSION)
    if not any(step.source_version == version for step in SCHEMA_MIGRATIONS)
]


def test_wipe_floor_registry_and_upgrade_gate_closed() -> None:
    """DDL is sole truth: empty registry, stamp 4, no pending upgrades."""
    assert CURRENT_SCHEMA_VERSION == 4
    assert SCHEMA_MIGRATIONS == ()
    assert not any(migration_pending(version) for version in range(0, 25))


@pytest.mark.asyncio
async def test_fresh_ddl_stamps_current_with_builtin_workset(tmp_path) -> None:
    """Empty DB + ensure_supported_schema → current stamp + seeded __user__."""
    path = str(tmp_path / "fresh-wipe-floor.db")
    db = Database(path)
    await db.connect()
    try:
        await ensure_supported_schema(db.conn)
        fingerprint = await inspect_schema(db.conn)
        assert fingerprint.version == CURRENT_SCHEMA_VERSION
        assert fingerprint == CURRENT_SCHEMA_FINGERPRINT
        assert await db.fetch_value("SELECT is_system FROM worksets WHERE id = ?", (SYSTEM_WORKSET_ID,)) == 1
        # user_events.workset_id is NOT NULL with default __user__.
        async with db.conn.execute("PRAGMA table_info(user_events)") as cursor:
            cols = {str(row[1]): row for row in await cursor.fetchall()}
        workset_col = cols["workset_id"]
        assert int(workset_col[3]) == 1  # notnull
        assert workset_col[4] is not None  # dflt_value present
        assert "__user__" in str(workset_col[4])
    finally:
        await db.close()


@pytest.mark.parametrize(
    "version",
    _HARD_REJECT_PRIOR_VERSIONS,
    ids=[f"stamped-v{version}" for version in _HARD_REJECT_PRIOR_VERSIONS],
)
@pytest.mark.asyncio
async def test_stamped_prior_schema_versions_are_hard_rejected_without_changes(tmp_path, version: int) -> None:
    """Stamped versions without a MigrationStep hard-reject at ensure_schema."""
    assert not any(step.source_version == version for step in SCHEMA_MIGRATIONS)
    path = str(tmp_path / f"stamped-v{version}.db")
    await make_existing_db(
        path,
        log_rows=[(f"log-v{version}", "2026-01-01T00:00:00Z", "info", "schema-test")],
    )
    conn = await aiosqlite.connect(path)
    try:
        await conn.execute(f"PRAGMA user_version={version}")
        await conn.commit()
    finally:
        await conn.close()

    before_logical = await logical_snapshot(path)
    before_file = file_snapshot(path)
    assert before_logical["version"] == version

    db = Database(path)
    await db.connect()
    try:
        with pytest.raises(
            SchemaBaselineError,
            match=rf"Unsupported database schema version {version}",
        ):
            await db.ensure_schema()
        assert await db.fetch_value("PRAGMA user_version") == version
        assert (
            await db.fetch_value(f"SELECT message FROM app_logs WHERE id = 'log-v{version}'")
            == f"message for log-v{version}"
        )
    finally:
        await db.close()

    assert await logical_snapshot(path) == before_logical
    assert file_snapshot(path) == before_file

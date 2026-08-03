"""Wipe-floor SoT: stamp-11 fresh DDL + prior stamps hard-reject (no mutation / reset path).

Fingerprint validation, unstamped current, and newer-than-supported: ``test_db_schema.py``.
"""

from __future__ import annotations

import logging

import pytest

from server.db.database import Database, SchemaBaselineError
from server.db.schema_bootstrap import (
    CURRENT_SCHEMA_FINGERPRINT,
    CURRENT_SCHEMA_VERSION,
    ensure_supported_schema,
    inspect_schema,
)
from server.tests.schema_fixtures import file_snapshot, logical_snapshot, make_stamped_db
from server.worksets_const import SYSTEM_WORKSET_ID

_HARD_REJECT_PRIOR_VERSIONS = list(range(1, CURRENT_SCHEMA_VERSION))


def test_wipe_floor_is_stamp_eleven() -> None:
    assert CURRENT_SCHEMA_VERSION == 11


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
        async with db.conn.execute("PRAGMA table_info(user_events)") as cursor:
            cols = {str(row[1]): row for row in await cursor.fetchall()}
        workset_col = cols["workset_id"]
        assert int(workset_col[3]) == 1  # notnull
        assert workset_col[4] is not None
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
    """Every non-current stamped version hard-rejects at ensure_schema."""
    path = str(tmp_path / f"stamped-v{version}.db")
    await make_stamped_db(
        path,
        version=version,
        log_rows=[(f"log-v{version}", "2026-01-01T00:00:00Z", "info", "schema-test")],
    )

    before_logical = await logical_snapshot(path)
    before_file = file_snapshot(path)
    assert before_logical["version"] == version

    db = Database(path)
    await db.connect()
    try:
        with pytest.raises(
            SchemaBaselineError,
            match=rf"Unsupported database schema version {version}.*reset_local_databases.py --apply",
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


@pytest.mark.asyncio
async def test_startup_rejection_names_the_reset_recovery_path(tmp_path, caplog) -> None:
    """App lifespan logs reset script for wipe-only prior stamps."""
    from server.main import create_app

    wipe_only_version = 1  # any prior stamp → hard-reject
    path = tmp_path / "startup-reject.db"
    await make_stamped_db(
        str(path),
        version=wipe_only_version,
        log_rows=[("log-startup-reject", "2026-01-01T00:00:00Z", "info", "schema-test")],
    )

    app = create_app(db_path=str(path), start_collector=False, start_scheduler=False, serve_static=False)
    with caplog.at_level(logging.ERROR, logger="server.main"), pytest.raises(SchemaBaselineError):
        async with app.router.lifespan_context(app):
            pass

    message = "\n".join(record.getMessage() for record in caplog.records)
    assert "scripts/reset_local_databases.py --apply" in message
    assert str(wipe_only_version) in message
    assert str(path) in message

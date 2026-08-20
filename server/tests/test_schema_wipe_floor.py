"""Wipe-floor SoT: stamp-45 fresh DDL + prior stamps hard-reject (no mutation / reset path).

Fingerprint validation, unstamped current, and newer-than-supported: ``test_db_schema.py``.
"""

from __future__ import annotations

import logging

import pytest

from server.db.database import Database, SchemaBaselineError
from server.db.schema_bootstrap import (
    CURRENT_SCHEMA_FINGERPRINT,
    CURRENT_SCHEMA_VERSION,
    SCHEMA_SEMVER,
    ensure_supported_schema,
    inspect_schema,
)
from server.tests.schema_fixtures import file_snapshot, logical_snapshot, make_stamped_db
from server.worksets_const import SYSTEM_WORKSET_ID

_HARD_REJECT_PRIOR_VERSIONS = list(range(1, CURRENT_SCHEMA_VERSION))


def test_wipe_floor_is_current_stamp() -> None:
    assert CURRENT_SCHEMA_VERSION == 45
    assert SCHEMA_SEMVER == "0.1.0-beta.46"


@pytest.mark.asyncio
async def test_fresh_ddl_stamps_current_with_builtin_workset(tmp_path) -> None:
    """Empty DB + ensure_supported_schema → current stamp + seeded __general__; zero LLM profiles."""
    path = str(tmp_path / "fresh-wipe-floor.db")
    db = Database(path)
    await db.connect()
    try:
        await ensure_supported_schema(db.conn)
        fingerprint = await inspect_schema(db.conn)
        assert fingerprint.version == CURRENT_SCHEMA_VERSION
        assert fingerprint == CURRENT_SCHEMA_FINGERPRINT
        assert await db.fetch_value("SELECT is_system FROM worksets WHERE id = ?", (SYSTEM_WORKSET_ID,)) == 1
        assert await db.fetch_value("SELECT notify_enabled FROM worksets WHERE id = ?", (SYSTEM_WORKSET_ID,)) == 1
        assert await db.fetch_value("SELECT external_enabled FROM worksets WHERE id = ?", (SYSTEM_WORKSET_ID,)) == 1
        assert int(await db.fetch_value("SELECT COUNT(*) FROM llm_profiles") or 0) == 0
        assert int(await db.fetch_value("SELECT COUNT(*) FROM llm_staff_instances") or 0) == 0
        async with db.conn.execute("PRAGMA table_info(user_events)") as cursor:
            cols = {str(row[1]): row for row in await cursor.fetchall()}
        workset_col = cols["workset_id"]
        assert int(workset_col[3]) == 1  # notnull
        assert workset_col[4] is not None
        assert "__general__" in str(workset_col[4])
        async with db.conn.execute("PRAGMA table_info(analysis_tasks)") as cursor:
            task_cols = {str(row[1]): row for row in await cursor.fetchall()}
        assert "llm_profile_id" in task_cols
        assert int(task_cols["llm_profile_id"][3]) == 1
        assert "notify_pref" in task_cols
        assert int(task_cols["notify_pref"][3]) == 1
        assert str(task_cols["notify_pref"][4]).replace("'", "") == "inherit"
        assert str(task_cols["output_analysis_events"][4]) == "1"
        task_workset = task_cols["workset_id"]
        assert int(task_workset[3]) == 1  # notnull
        assert task_workset[4] is not None
        assert "__general__" in str(task_workset[4])
        async with db.conn.execute("PRAGMA table_info(worksets)") as cursor:
            workset_cols = {str(row[1]): row for row in await cursor.fetchall()}
        assert "notify_enabled" in workset_cols
        assert int(workset_cols["notify_enabled"][3]) == 1
        assert "external_enabled" in workset_cols
        assert int(workset_cols["external_enabled"][3]) == 1
        async with db.conn.execute("PRAGMA table_info(user_events)") as cursor:
            ue_cols = {str(row[1]): row for row in await cursor.fetchall()}
        assert "notify_pref" in ue_cols
        assert str(ue_cols["notify_pref"][4]).replace("'", "") == "off"
        async with db.conn.execute("PRAGMA table_info(recurring_schedules)") as cursor:
            rec_cols = {str(row[1]): row for row in await cursor.fetchall()}
        assert "notify_pref" in rec_cols
        assert str(rec_cols["notify_pref"][4]).replace("'", "") == "off"
        assert "emoji" in rec_cols
        assert int(rec_cols["emoji"][3]) == 0
        assert str(rec_cols["emoji"][4] or "NULL").replace("'", "").upper() == "NULL"
        assert "emoji" in ue_cols
        assert int(ue_cols["emoji"][3]) == 0
        assert str(ue_cols["emoji"][4] or "NULL").replace("'", "").upper() == "NULL"
        assert "emoji" in task_cols
        assert int(task_cols["emoji"][3]) == 0
        assert str(task_cols["emoji"][4] or "NULL").replace("'", "").upper() == "NULL"
        async with db.conn.execute("PRAGMA table_info(llm_profiles)") as cursor:
            profile_cols = {str(row[1]): row for row in await cursor.fetchall()}
        assert "tavily_search_api_key" in profile_cols
        assert "perplexity_search_api_key" in profile_cols
        assert "serper_search_api_key" in profile_cols
        assert int(profile_cols["tavily_search_api_key"][3]) == 1
        assert int(profile_cols["perplexity_search_api_key"][3]) == 1
        assert int(profile_cols["serper_search_api_key"][3]) == 1
        assert "web_fetch" not in profile_cols
        assert not any("fetch" in name for name in profile_cols)
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
    with caplog.at_level(logging.ERROR, logger="server.main"), pytest.raises(SchemaBaselineError) as raised:
        async with app.router.lifespan_context(app):
            pass

    message = "\n".join(record.getMessage() for record in caplog.records)
    assert "scripts/reset_local_databases.py --apply" in message
    assert str(path) in message
    assert str(wipe_only_version) in str(raised.value)
    assert str(CURRENT_SCHEMA_VERSION) in str(raised.value)

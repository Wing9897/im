"""Schema floor SoT: stamp 4 + retired future stamps 27/45 hard-reject.

Additive 1→4 walks live in ``test_schema_migrate.py``. Fingerprint validation,
unstamped current, and newer-than-supported: ``test_db_schema.py``.
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
from server.tests.schema_fixtures import file_snapshot, logical_snapshot, make_pre_schema_meta_db, make_stamped_db
from server.worksets_const import SYSTEM_WORKSET_ID

# Retired pre-cut stamps greater than CURRENT=4 still hard-reject (future-stamp path).
_HARD_REJECT_FUTURE_VERSIONS = (27, 45)


def test_floor_is_current_stamp() -> None:
    assert CURRENT_SCHEMA_VERSION == 4
    assert SCHEMA_SEMVER == "1.3.0"
    assert CURRENT_SCHEMA_VERSION not in _HARD_REJECT_FUTURE_VERSIONS
    assert all(version > CURRENT_SCHEMA_VERSION for version in _HARD_REJECT_FUTURE_VERSIONS)


def test_schema_meta_ddl_seeds_current_semver() -> None:
    """Fresh DDL and 1→2 must write the same ``schema_meta`` singleton."""
    from server.db.schema_domains.system import DDL as SYSTEM_DDL

    assert f"VALUES (1, '{SCHEMA_SEMVER}')" in SYSTEM_DDL


@pytest.mark.asyncio
async def test_fresh_ddl_stamps_current_with_builtin_workset(tmp_path) -> None:
    """Empty DB + ensure_supported_schema → stamp 4 + schema_meta + seeded __general__."""
    path = str(tmp_path / "fresh-floor.db")
    db = Database(path)
    await db.connect()
    try:
        await ensure_supported_schema(db.conn, db.path)
        fingerprint = await inspect_schema(db.conn)
        assert fingerprint.version == CURRENT_SCHEMA_VERSION
        assert fingerprint == CURRENT_SCHEMA_FINGERPRINT
        tables = {
            str(row["name"])
            for row in await db.fetch_all(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
            )
        }
        assert "schema_meta" in tables
        assert "calendar_share_publish" in tables
        assert await db.fetch_value("SELECT schema_semver FROM schema_meta WHERE id = 1") == SCHEMA_SEMVER
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
        assert "emoji" in workset_cols
        assert int(workset_cols["emoji"][3]) == 1
        assert str(workset_cols["emoji"][4]).replace('"', "").replace("'", "") == ""
        assert "description" in workset_cols
        assert int(workset_cols["description"][3]) == 1
        assert str(workset_cols["description"][4]).replace('"', "").replace("'", "") == ""
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
        async with db.conn.execute("PRAGMA table_info(schema_meta)") as cursor:
            meta_cols = {str(row[1]): row for row in await cursor.fetchall()}
        assert "id" in meta_cols
        assert "schema_semver" in meta_cols
    finally:
        await db.close()


@pytest.mark.parametrize(
    "version",
    _HARD_REJECT_FUTURE_VERSIONS,
    ids=[f"stamped-v{version}" for version in _HARD_REJECT_FUTURE_VERSIONS],
)
@pytest.mark.asyncio
async def test_stamped_prior_schema_versions_are_hard_rejected_without_changes(tmp_path, version: int) -> None:
    """Retired stamps greater than CURRENT hard-reject at ensure_schema."""
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
            match=(
                rf"Unsupported database schema version {version}.*"
                r"Update the application.*"
                r"reset_local_databases.py --apply"
            ),
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
async def test_current_lookalike_missing_schema_meta_is_rejected(tmp_path) -> None:
    """Pre-cut current stamp without schema_meta is not treated as already migrated."""
    path = str(tmp_path / "current-lookalike.db")
    await make_pre_schema_meta_db(
        path,
        version=CURRENT_SCHEMA_VERSION,
        strip_workset_stamp3=False,
        log_rows=[("log-lookalike", "2026-01-01T00:00:00Z", "info", "schema-test")],
    )
    before_logical = await logical_snapshot(path)
    before_file = file_snapshot(path)

    db = Database(path)
    await db.connect()
    try:
        with pytest.raises(SchemaBaselineError, match="fingerprint mismatch"):
            await db.ensure_schema()
        assert await db.fetch_value("PRAGMA user_version") == CURRENT_SCHEMA_VERSION
        assert await db.fetch_value("SELECT message FROM app_logs WHERE id = 'log-lookalike'") == (
            "message for log-lookalike"
        )
    finally:
        await db.close()

    assert await logical_snapshot(path) == before_logical
    assert file_snapshot(path) == before_file


@pytest.mark.asyncio
async def test_startup_rejection_names_the_reset_recovery_path(tmp_path, caplog) -> None:
    """App lifespan logs the future-stamp reject (reset remains a last resort)."""
    from server.main import create_app

    future_version = 45
    path = tmp_path / "startup-reject.db"
    await make_stamped_db(
        str(path),
        version=future_version,
        log_rows=[("log-startup-reject", "2026-01-01T00:00:00Z", "info", "schema-test")],
    )

    app = create_app(db_path=str(path), start_collector=False, start_scheduler=False, serve_static=False)
    with caplog.at_level(logging.ERROR, logger="server.main"), pytest.raises(SchemaBaselineError) as raised:
        async with app.router.lifespan_context(app):
            pass

    message = "\n".join(record.getMessage() for record in caplog.records)
    assert "Update the application" in message
    assert "scripts/reset_local_databases.py --apply" in message
    assert str(path) in message
    assert str(future_version) in str(raised.value)
    assert str(CURRENT_SCHEMA_VERSION) in str(raised.value)

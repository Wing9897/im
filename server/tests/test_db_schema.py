"""Schema lifecycle tests for server/db/database.py.

Wipe-floor SoT (stamp-24 / prior hard-reject): ``test_schema_wipe_floor.py``.
This module covers fingerprint validation, unstamped current, and newer-than-supported.
"""

from __future__ import annotations

from typing import Any, Literal

import aiosqlite
import pytest

from server.db.database import Database, SchemaBaselineError
from server.db.schema import DDL
from server.db.schema_bootstrap import (
    CURRENT_SCHEMA_FINGERPRINT,
    CURRENT_SCHEMA_VERSION,
    SchemaFingerprint,
    inspect_schema,
)
from server.tests.schema_fixtures import (
    file_snapshot,
    logical_snapshot,
    make_existing_db,
    make_lookalike_db,
    make_stamped_db,
)

_REQUIRED_TABLE_COUNT = 28
_SCHEMA_DEFECT = Literal["column", "index", "foreign_key"]


async def test_fresh_database_creates_full_schema(tmp_path):
    db = Database(str(tmp_path / "fresh.db"))
    await db.connect()
    try:
        await db.ensure_schema()
        tables = {
            row["name"]
            for row in await db.fetch_all(
                "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
            )
        }
        app_log_columns = {row["name"] for row in await db.fetch_all("PRAGMA table_info(app_logs)")}
        app_log_indexes = {row["name"] for row in await db.fetch_all("PRAGMA index_list(app_logs)")}
        source_channel_fks = {
            (row["from"], row["table"], row["to"], row["on_delete"])
            for row in await db.fetch_all("PRAGMA foreign_key_list(source_channels)")
        }

        assert len(tables) == _REQUIRED_TABLE_COUNT
        assert {"messages", "analysis_tasks"} <= tables
        assert "details" in app_log_columns
        assert "kind" in app_log_columns
        assert "idx_app_logs_time" in app_log_indexes
        assert "idx_app_logs_kind_time" in app_log_indexes
        assert source_channel_fks == {
            ("source_id", "sources", "id", "CASCADE"),
            ("platform", "channels", "platform", "CASCADE"),
            ("platform_id", "channels", "platform_id", "CASCADE"),
        }
        assert await db.fetch_value("PRAGMA user_version") == CURRENT_SCHEMA_VERSION
    finally:
        await db.close()


async def test_exact_unstamped_current_schema_is_stamped_without_data_loss(tmp_path):
    path = str(tmp_path / "unstamped-current.db")
    await make_existing_db(path, log_rows=[("log-1", "2026-01-01T00:00:00Z", "info", "system")])

    conn = await aiosqlite.connect(path)
    try:
        await conn.execute(
            "INSERT INTO channels (platform, platform_id, channel_name, created_at) "
            "VALUES ('telegram', 'chan-1', 'News', '2026-01-01T00:00:00Z')"
        )
        await conn.execute(
            "INSERT INTO messages (id, platform, platform_id, content, timestamp, created_at) "
            "VALUES ('msg-1', 'telegram', 'chan-1', 'hello', "
            "'2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')"
        )
        await conn.commit()
    finally:
        await conn.close()

    db = Database(path)
    await db.connect()
    try:
        await db.ensure_schema()
        assert await db.fetch_value("PRAGMA user_version") == CURRENT_SCHEMA_VERSION
        assert await db.fetch_value("SELECT COUNT(*) FROM messages") == 1
        assert await db.fetch_value("SELECT COUNT(*) FROM channels") == 1
        assert await db.fetch_value("SELECT content FROM messages WHERE id = 'msg-1'") == "hello"
        assert await db.fetch_value("SELECT message FROM app_logs WHERE id = 'log-1'") == "message for log-1"
    finally:
        await db.close()


async def test_exact_current_schema_is_fully_validated_without_changes(tmp_path):
    path = str(tmp_path / "current.db")
    await make_stamped_db(
        path,
        version=CURRENT_SCHEMA_VERSION,
        log_rows=[("log-1", "2026-01-01T00:00:00Z", "info", "collector")],
    )
    before_logical = await logical_snapshot(path)
    before_file = file_snapshot(path)

    db = Database(path)
    await db.connect()
    try:
        await db.ensure_schema()
    finally:
        await db.close()

    assert await logical_snapshot(path) == before_logical
    assert file_snapshot(path) == before_file


async def test_ensure_schema_is_idempotent(tmp_path):
    path = str(tmp_path / "existing.db")
    await make_existing_db(path, log_rows=[("log-1", "2026-01-01T00:00:00Z", "info", "collector")])

    db = Database(path)
    await db.connect()
    try:
        await db.ensure_schema()
        first = {
            "version": await db.fetch_value("PRAGMA user_version"),
            "rows": await db.fetch_all("SELECT id, category FROM app_logs"),
        }
        await db.ensure_schema()
        second = {
            "version": await db.fetch_value("PRAGMA user_version"),
            "rows": await db.fetch_all("SELECT id, category FROM app_logs"),
        }
        assert second == first
    finally:
        await db.close()


@pytest.mark.parametrize("version", [0, CURRENT_SCHEMA_VERSION], ids=["version-0", "current-version"])
@pytest.mark.parametrize(
    "defect",
    ["column", "index", "foreign_key"],
    ids=["missing-column", "missing-index", "missing-fk"],
)
async def test_incomplete_lookalike_is_rejected_without_mutation(tmp_path, version: int, defect: _SCHEMA_DEFECT):
    path = str(tmp_path / f"lookalike-{version}-{defect}.db")
    await make_lookalike_db(path, version=version, defect=defect)
    before_logical = await logical_snapshot(path)
    before_file = file_snapshot(path)

    caught: SchemaBaselineError | None = None
    db = Database(path)
    await db.connect()
    try:
        try:
            await db.ensure_schema()
        except SchemaBaselineError as exc:
            caught = exc
    finally:
        await db.close()

    after_logical = await logical_snapshot(path)
    after_file = file_snapshot(path)
    assert after_logical["version"] == before_logical["version"]
    assert after_logical["rows"] == before_logical["rows"]
    assert after_logical["schema"] == before_logical["schema"]
    assert after_file == before_file
    assert caught is not None, f"version {version} database missing required {defect} was accepted"
    expected_category = {
        "column": "columns",
        "index": "indexes",
        "foreign_key": "foreign keys",
    }[defect]
    assert expected_category in str(caught).lower()
    assert "delete" not in str(caught).lower()


def test_analysis_time_range_values_are_canonical_offset_keys() -> None:
    """Task and message windows share the same resolvable offset keys.

    ``7days`` / ``30days`` aliases are gone from both the task CHECK and
    ``_TIME_RANGE_OFFSETS`` (monitor／agent send ``7d``／``30d`` only).
    """
    from server.analyzer.incremental import _TIME_RANGE_OFFSETS
    from server.db.schema_domains.vocabulary import ANALYSIS_TIME_RANGE_VALUES

    values = set(ANALYSIS_TIME_RANGE_VALUES)
    assert values - {"all", "today"} <= set(_TIME_RANGE_OFFSETS)
    assert not values & {"7days", "30days"}
    assert not {"7days", "30days"} & set(_TIME_RANGE_OFFSETS)


async def test_partial_table_inventory_is_preserved_and_startup_stops(tmp_path):
    path = str(tmp_path / "incompatible.db")
    conn = await aiosqlite.connect(path)
    try:
        await conn.execute("PRAGMA journal_mode=WAL")
        await conn.execute("CREATE TABLE messages (id TEXT PRIMARY KEY)")
        await conn.execute("INSERT INTO messages (id) VALUES ('old-row')")
        await conn.commit()
    finally:
        await conn.close()

    before_file = file_snapshot(path)
    db = Database(path)
    await db.connect()
    try:
        with pytest.raises(SchemaBaselineError):
            await db.ensure_schema()
        assert await db.fetch_value("SELECT id FROM messages") == "old-row"
        assert await db.fetch_value("PRAGMA user_version") == 0
    finally:
        await db.close()
    assert file_snapshot(path) == before_file


async def test_newer_schema_version_is_rejected_without_changes(tmp_path):
    path = str(tmp_path / "future.db")
    conn = await aiosqlite.connect(path)
    try:
        await conn.execute("PRAGMA journal_mode=WAL")
        await conn.execute("CREATE TABLE preserved (value TEXT)")
        await conn.execute("INSERT INTO preserved VALUES ('keep-me')")
        await conn.execute(f"PRAGMA user_version={CURRENT_SCHEMA_VERSION + 1}")
        await conn.commit()
    finally:
        await conn.close()

    before_file = file_snapshot(path)
    db = Database(path)
    await db.connect()
    try:
        with pytest.raises(SchemaBaselineError, match="newer than supported"):
            await db.ensure_schema()
        assert await db.fetch_value("PRAGMA user_version") == CURRENT_SCHEMA_VERSION + 1
        assert await db.fetch_value("SELECT value FROM preserved") == "keep-me"
    finally:
        await db.close()
    assert file_snapshot(path) == before_file


# Stamps above CURRENT (pre-restart leftovers) → "newer than supported".
# Prior wipe-floor hard-reject + lifespan reset log: ``test_schema_wipe_floor``.
_NEWER_THAN_SUPPORTED = tuple(v for v in (16, 23, 24) if v > CURRENT_SCHEMA_VERSION)


@pytest.mark.parametrize(
    "version",
    _NEWER_THAN_SUPPORTED,
    ids=[f"newer-stamped-v{version}" for version in _NEWER_THAN_SUPPORTED],
)
async def test_stamps_above_current_are_hard_rejected_without_changes(tmp_path, version: int) -> None:
    path = str(tmp_path / f"newer-v{version}.db")
    await make_stamped_db(
        path,
        version=version,
        log_rows=[(f"log-v{version}", "2026-01-01T00:00:00Z", "info", "schema-test")],
    )
    before_logical = await logical_snapshot(path)
    before_file = file_snapshot(path)

    db = Database(path)
    await db.connect()
    try:
        with pytest.raises(SchemaBaselineError, match="newer than supported"):
            await db.ensure_schema()
        assert await db.fetch_value("PRAGMA user_version") == version
    finally:
        await db.close()

    assert await logical_snapshot(path) == before_logical
    assert file_snapshot(path) == before_file


async def test_ddl_derived_fingerprint_matches_live_introspection():
    """The import-time DDL-derived fingerprint equals a live aiosqlite introspection."""
    conn = await aiosqlite.connect(":memory:")
    try:
        await conn.executescript(DDL)
        await conn.execute(f"PRAGMA user_version={CURRENT_SCHEMA_VERSION}")
        fingerprint = await inspect_schema(conn)

        raw_auto_indexes: set[str] = set()
        for table in fingerprint.tables:
            cursor = await conn.execute(f'PRAGMA index_list("{table}")')
            raw_auto_indexes.update(str(row[1]) for row in await cursor.fetchall() if str(row[1]).startswith("sqlite_"))
            await cursor.close()

        assert raw_auto_indexes, "DDL fixture should exercise SQLite auto-index exclusion"
        assert fingerprint == CURRENT_SCHEMA_FINGERPRINT
        assert all(
            not index.name.startswith("sqlite_")
            for table_indexes in fingerprint.indexes.values()
            for index in table_indexes
        )
    finally:
        await conn.close()


def test_schema_fingerprint_is_immutable_and_order_independent():
    expected = CURRENT_SCHEMA_FINGERPRINT
    permuted = SchemaFingerprint(
        version=expected.version,
        tables=frozenset(reversed(sorted(expected.tables))),
        columns=dict(reversed(list(expected.columns.items()))),
        indexes=dict(reversed(list(expected.indexes.items()))),
        foreign_keys=dict(reversed(list(expected.foreign_keys.items()))),
    )

    assert permuted == expected
    assert hash(permuted) == hash(expected)
    columns: Any = permuted.columns
    with pytest.raises(TypeError):
        columns["sources"] = frozenset()


_STRUCTURAL_LOOKALIKE_CASES = (
    (
        "columns",
        "declared-type",
        "    details   TEXT\n);",
        "    details   INTEGER\n);",
    ),
    (
        "indexes",
        "sort-direction",
        "CREATE INDEX IF NOT EXISTS idx_app_logs_time ON app_logs(time DESC, id DESC);",
        "CREATE INDEX IF NOT EXISTS idx_app_logs_time ON app_logs(time ASC, id DESC);",
    ),
    (
        "foreign keys",
        "group-partition",
        """    FOREIGN KEY (platform, platform_id)
        REFERENCES channels(platform, platform_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages""",
        """    FOREIGN KEY (platform) REFERENCES channels(platform) ON DELETE CASCADE,
    FOREIGN KEY (platform_id) REFERENCES channels(platform_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages""",
    ),
)


async def _make_structural_lookalike_db(
    path: str,
    *,
    version: int,
    old_ddl: str,
    new_ddl: str,
) -> None:
    """Create a non-empty exact-name lookalike with one metadata defect."""
    assert DDL.count(old_ddl) == 1
    conn = await aiosqlite.connect(path)
    try:
        await conn.execute("PRAGMA journal_mode=WAL")
        await conn.executescript(DDL.replace(old_ddl, new_ddl, 1))
        await conn.execute(
            "INSERT INTO app_logs (id, time, level, category, kind, message, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
            ("sentinel", "2026-01-01T00:00:00Z", "info", "schema-test", "system", "preserved", "{}"),
        )
        await conn.execute(f"PRAGMA user_version={version}")
        await conn.commit()
    finally:
        await conn.close()


async def _complete_logical_snapshot(path: str) -> dict[str, Any]:
    """Capture version, SQL inventory, and every domain value after close."""
    conn = await aiosqlite.connect(path)
    try:
        version_cursor = await conn.execute("PRAGMA user_version")
        version_row = await version_cursor.fetchone()
        await version_cursor.close()
        schema_cursor = await conn.execute(
            "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name"
        )
        schema = tuple(tuple(row) for row in await schema_cursor.fetchall())
        await schema_cursor.close()

        domain: dict[str, tuple[tuple[Any, ...], ...]] = {}
        table_names = sorted(row[1] for row in schema if row[0] == "table")
        for table in table_names:
            quoted_table = '"' + str(table).replace('"', '""') + '"'
            rows_cursor = await conn.execute(f"SELECT * FROM {quoted_table}")
            domain[str(table)] = tuple(tuple(row) for row in await rows_cursor.fetchall())
            await rows_cursor.close()

        assert version_row is not None
        return {"version": int(version_row[0]), "schema": schema, "domain": domain}
    finally:
        await conn.close()


@pytest.mark.parametrize("version", [0, CURRENT_SCHEMA_VERSION], ids=["version-0", "current-version"])
@pytest.mark.parametrize(
    ("expected_category", "dimension", "old_ddl", "new_ddl"),
    _STRUCTURAL_LOOKALIKE_CASES,
    ids=[case[1] for case in _STRUCTURAL_LOOKALIKE_CASES],
)
async def test_structural_lookalike_is_rejected_without_closed_snapshot_mutation(
    tmp_path,
    version: int,
    expected_category: str,
    dimension: str,
    old_ddl: str,
    new_ddl: str,
) -> None:
    """Structural DDL lookalike (wrong column/index/FK shape) hard-rejects; DB unchanged."""
    path = str(tmp_path / f"structural-{version}-{dimension}.db")
    await _make_structural_lookalike_db(path, version=version, old_ddl=old_ddl, new_ddl=new_ddl)
    before_logical = await _complete_logical_snapshot(path)
    before_files = file_snapshot(path)

    caught: SchemaBaselineError | None = None
    db = Database(path)
    await db.connect()
    try:
        try:
            await db.ensure_schema()
        except SchemaBaselineError as exc:
            caught = exc
    finally:
        await db.close()

    after_logical = await _complete_logical_snapshot(path)
    after_files = file_snapshot(path)
    assert caught is not None, f"{dimension} structural lookalike at version {version} was accepted"
    assert expected_category in str(caught).lower()
    assert after_logical == before_logical
    assert after_files == before_files

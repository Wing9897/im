"""Property tests for SQLite schema evolution convergence.

Four properties are kept here, one per distinct risk:

1. classification is complete and discovery-order independent;
2. evaluating a supported schema converges and loses no data;
3. duplicate-identical foreign-key groups are rejected by the oracle;
4. and are also rejected at real startup without touching the file.

Earlier rounds also carried mutation-matrix and preservation-matrix variants
that re-derived the same guarantees through a different generator. They were
dropped with the v17 baseline: ``test_db_schema.py`` covers the same
dimensions against the executable DDL, so the extra ~750 lines only bought
slower runs.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, replace
from pathlib import Path
from random import Random
from typing import Any, Iterable, Mapping, TypeVar

import aiosqlite
import pytest
from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from server.db.migrations import (
    CURRENT_SCHEMA_FINGERPRINT,
    CURRENT_SCHEMA_VERSION,
    ColumnSignature,
    ForeignKeyGroupSignature,
    IndexSignature,
    SchemaEvolutionError,
    SchemaFingerprint,
    _require_current_structure,
    ensure_supported_schema,
    inspect_schema,
)
from server.db.schema import DDL, REQUIRED_TABLES
from server.db.schema_ddl import PLATFORM_CHECK_VALUES
from server.domain.analysis_modes import ALL_ANALYSIS_MODES

_TRACE_MARKER = "Feature: codebase-simplification-round-2, Property 1"
_MIN_PROPERTY_EXAMPLES = 12
_MISMATCH_LABELS = {
    "table": "tables",
    "column": "columns",
    "index": "indexes",
    "foreign_key": "foreign keys",
}
_Element = TypeVar("_Element")
_Signature = TypeVar("_Signature", ColumnSignature, IndexSignature, ForeignKeyGroupSignature)


def _shuffled(values: Iterable[_Element], rng: Random) -> list[_Element]:
    shuffled = list(values)
    rng.shuffle(shuffled)
    return shuffled


def _permuted_mapping(values: Mapping[str, Iterable[_Element]], rng: Random) -> dict[str, list[_Element]]:
    items = list(values.items())
    rng.shuffle(items)
    return {table: _shuffled(elements, rng) for table, elements in items}


def _without_element(
    values: Mapping[str, Iterable[_Element]], table: str, element: _Element
) -> dict[str, list[_Element]]:
    return {
        current_table: [candidate for candidate in elements if current_table != table or candidate != element]
        for current_table, elements in values.items()
    }


def _fingerprint(
    version: int,
    tables: Iterable[str],
    columns: Mapping[str, Iterable[ColumnSignature]],
    indexes: Mapping[str, Iterable[IndexSignature]],
    foreign_keys: Mapping[str, Iterable[ForeignKeyGroupSignature]],
) -> SchemaFingerprint:
    return SchemaFingerprint(
        version=version,
        tables=frozenset(tables),
        columns={table: frozenset(values) for table, values in columns.items()},
        indexes={table: frozenset(values) for table, values in indexes.items()},
        foreign_keys={table: tuple(values) for table, values in foreign_keys.items()},
    )


@dataclass(frozen=True, slots=True)
class _RowPayload:
    text: str
    optional_text: str | None
    integer: int
    real: float
    enabled: bool
    platform: str
    account_status: str
    analysis_mode: str
    analysis_time_range: str
    log_level: str
    schedule_type: str
    batch_status: str
    action_type: str
    action_status: str


@dataclass(frozen=True, slots=True)
class _DomainFixture:
    version: int
    rows: tuple[_RowPayload, ...]


@dataclass(frozen=True, slots=True)
class _TableSnapshot:
    columns: tuple[str, ...]
    primary_key_columns: tuple[str, ...]
    primary_keys: tuple[tuple[Any, ...], ...]
    row_count: int
    rows: tuple[tuple[Any, ...], ...]


def _snapshot(fingerprint: SchemaFingerprint) -> tuple[Any, ...]:
    def mapping_snapshot(values: Mapping[str, Iterable[_Signature]]) -> tuple[Any, ...]:
        return tuple((table, tuple(sorted(elements))) for table, elements in sorted(values.items()))

    return (
        fingerprint.version,
        tuple(sorted(fingerprint.tables)),
        mapping_snapshot(fingerprint.columns),
        mapping_snapshot(fingerprint.indexes),
        mapping_snapshot(fingerprint.foreign_keys),
    )


@st.composite
def _schema_classification_cases(
    draw: st.DrawFn,
) -> tuple[SchemaFingerprint, dict[str, SchemaFingerprint]]:
    expected = CURRENT_SCHEMA_FINGERPRINT
    rng = Random(draw(st.integers(min_value=0, max_value=2**32 - 1)))
    tables = _shuffled(expected.tables, rng)
    columns = _permuted_mapping(expected.columns, rng)
    indexes = _permuted_mapping(expected.indexes, rng)
    foreign_keys = _permuted_mapping(expected.foreign_keys, rng)

    missing_table = draw(st.sampled_from(sorted(expected.tables)))
    missing_column = draw(
        st.sampled_from(
            sorted((table, column) for table, table_columns in expected.columns.items() for column in table_columns)
        )
    )
    missing_index = draw(
        st.sampled_from(
            sorted((table, index) for table, table_indexes in expected.indexes.items() for index in table_indexes)
        )
    )
    missing_foreign_key = draw(
        st.sampled_from(
            sorted(
                (table, foreign_key)
                for table, table_foreign_keys in expected.foreign_keys.items()
                for foreign_key in table_foreign_keys
            )
        )
    )
    defect_version = draw(st.sampled_from((0, CURRENT_SCHEMA_VERSION)))

    exact = _fingerprint(CURRENT_SCHEMA_VERSION, tables, columns, indexes, foreign_keys)
    defects = {
        "table": _fingerprint(
            defect_version,
            [table for table in tables if table != missing_table],
            columns,
            indexes,
            foreign_keys,
        ),
        "column": _fingerprint(
            defect_version,
            tables,
            _without_element(columns, *missing_column),
            indexes,
            foreign_keys,
        ),
        "index": _fingerprint(
            defect_version,
            tables,
            columns,
            _without_element(indexes, *missing_index),
            foreign_keys,
        ),
        "foreign_key": _fingerprint(
            defect_version,
            tables,
            columns,
            indexes,
            _without_element(foreign_keys, *missing_foreign_key),
        ),
    }
    return exact, defects


_TEXT = st.text(
    alphabet=st.characters(blacklist_categories=("Cs",), blacklist_characters="\x00"),
    max_size=16,
)
_ROW_PAYLOADS = st.builds(
    _RowPayload,
    text=_TEXT,
    optional_text=st.one_of(st.none(), _TEXT),
    integer=st.integers(min_value=0, max_value=10_000),
    real=st.floats(min_value=-10_000, max_value=10_000, allow_nan=False, allow_infinity=False),
    enabled=st.booleans(),
    platform=st.sampled_from(PLATFORM_CHECK_VALUES),
    account_status=st.sampled_from(("connected", "disconnected", "error")),
    analysis_mode=st.sampled_from(ALL_ANALYSIS_MODES),
    # v17 CHECK: must match schema_ddl.ANALYSIS_TIME_RANGE_VALUES / APP_LOG_LEVEL_VALUES.
    # The ``7days`` / ``30days`` aliases were dropped from the task CHECK in v17.
    analysis_time_range=st.sampled_from(("all", "today", "1h", "6h", "12h", "24h", "48h", "1d", "7d", "30d")),
    log_level=st.sampled_from(("info", "success", "warning", "error")),
    schedule_type=st.sampled_from(("seconds_10", "hourly", "daily", "weekly", "custom_seconds")),
    batch_status=st.sampled_from(("pending", "processing", "completed")),
    action_type=st.sampled_from(("telegram_bot", "discord_webhook", "http_webhook", "mqtt")),
    action_status=st.sampled_from(("success", "failure")),
)
_DOMAIN_FIXTURES = st.builds(
    _DomainFixture,
    version=st.sampled_from((0, CURRENT_SCHEMA_VERSION)),
    rows=st.lists(_ROW_PAYLOADS, min_size=1, max_size=2).map(tuple),
)


def _quote(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def _schedule_value(payload: _RowPayload) -> str | None:
    if payload.schedule_type == "custom_seconds":
        return str(payload.integer + 1)
    if payload.schedule_type == "daily":
        return "12:34"
    if payload.schedule_type == "weekly":
        return "2:12:34"
    return None


async def _insert_domain_fixture(conn: aiosqlite.Connection, fixture: _DomainFixture) -> None:
    """Insert complete, constraint-valid row graphs into every application table."""
    await conn.executescript(DDL)
    for index, payload in enumerate(fixture.rows):
        suffix = str(index)
        timestamp = f"2026-01-{index + 1:02d}T00:00:00Z"
        account_id = f"account-{suffix}"
        channel_id = f"channel-{suffix}"
        message_id = f"message-{suffix}"
        task_id = f"task-{suffix}"
        batch_id = f"batch-{suffix}"
        topic_id = f"topic-{suffix}"
        action_id = f"action-{suffix}"
        json_value = json.dumps({"value": payload.text}, ensure_ascii=False)

        await conn.execute(
            "INSERT INTO accounts VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                account_id,
                payload.platform,
                payload.text,
                payload.account_status,
                json_value,
                payload.optional_text,
                payload.optional_text,
                timestamp,
                timestamp,
            ),
        )
        await conn.execute(
            "INSERT INTO channels VALUES (?, ?, ?, ?)",
            (payload.platform, channel_id, payload.optional_text, timestamp),
        )
        await conn.execute(
            "INSERT INTO account_channels VALUES (?, ?, ?)",
            (account_id, payload.platform, channel_id),
        )
        await conn.execute(
            "INSERT INTO messages VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                message_id,
                account_id,
                payload.platform,
                channel_id,
                f"platform-message-{suffix}",
                payload.optional_text,
                payload.optional_text,
                payload.text,
                timestamp,
                json_value,
                timestamp,
            ),
        )
        await conn.execute(
            "INSERT INTO analysis_tasks ("
            "id, name, description, prompt_template, analysis_mode, analysis_time_range, version, is_active, "
            "schedule_type, schedule_value, rrule, event_start_time, event_end_time, event_is_all_day, "
            "event_location, event_description, event_timezone, event_timezone_ical, event_start_local, "
            "event_end_local, event_exdates_json, event_rdates_json, ics_uid, ics_source, "
            "ics_import_fingerprint, include_in_timeline, parent_task_id, workset_id, "
            "project_wave_interval_seconds, batch_overlap_count, analysis_trigger_threshold, "
            "analysis_batch_message_limit, analysis_strategy_mode, created_at, updated_at"
            ") VALUES ("
            "?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "
            "?, ?, ?, ?, ?"
            ")",
            (
                task_id,
                payload.text,
                payload.optional_text,
                payload.text,
                payload.analysis_mode,
                payload.analysis_time_range,
                payload.integer,
                int(payload.enabled),
                payload.schedule_type,
                _schedule_value(payload),
                payload.optional_text,
                payload.optional_text,
                payload.optional_text,
                int(payload.enabled),
                payload.optional_text,
                payload.optional_text,
                payload.optional_text,  # event_timezone
                payload.optional_text,  # event_timezone_ical
                payload.optional_text,  # event_start_local
                payload.optional_text,  # event_end_local
                "[]",  # event_exdates_json
                "[]",  # event_rdates_json
                f"uid-{suffix}",
                "property-test",
                f"fingerprint-{suffix}",
                1,  # include_in_timeline
                None,  # parent_task_id
                None,  # workset_id
                None,  # project_wave_interval_seconds
                None,  # batch_overlap_count
                None,  # analysis_trigger_threshold
                None,  # analysis_batch_message_limit
                None,  # analysis_strategy_mode
                timestamp,
                timestamp,
            ),
        )
        await conn.execute(
            "INSERT INTO task_channels VALUES (?, ?, ?)",
            (task_id, payload.platform, channel_id),
        )

        await conn.execute(
            "INSERT INTO analysis_batches VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                batch_id,
                task_id,
                payload.integer,
                payload.batch_status,
                payload.integer,
                payload.integer,
                payload.optional_text,
                payload.integer,
                payload.integer,
                timestamp,
                timestamp,
                timestamp if payload.batch_status == "completed" else None,
                payload.optional_text,  # agent_message
                None,  # tool_calls_json
            ),
        )
        await conn.execute(
            "INSERT INTO analysis_markers VALUES (?, ?, ?, ?, ?, ?)",
            (f"marker-{suffix}", message_id, task_id, payload.integer, batch_id, timestamp),
        )
        await conn.execute(
            "INSERT INTO trending_topics VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                topic_id,
                task_id,
                payload.integer,
                batch_id,
                payload.integer,
                payload.text,
                payload.real,
                payload.optional_text,
                timestamp,
                timestamp,
            ),
        )
        await conn.execute(
            "INSERT INTO topic_messages VALUES (?, ?)",
            (topic_id, message_id),
        )
        await conn.execute(
            "INSERT INTO analysis_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                f"analysis-event-{suffix}",
                task_id,
                payload.integer,
                batch_id,
                payload.text,
                payload.text,
                timestamp,
                payload.optional_text,
                payload.text,
                payload.real,
                payload.real,
                json_value,
                message_id,
                json_value,
                f"content-hash-{suffix}",
                f"semantic-hash-{suffix}",
                f"event-key-{suffix}",
                timestamp,
                timestamp,
            ),
        )
        await conn.execute(
            "INSERT INTO system_config VALUES (?, ?, ?)",
            (f"config-{suffix}", payload.text, timestamp),
        )
        await conn.execute(
            "INSERT INTO app_logs VALUES (?, ?, ?, ?, ?, ?)",
            (
                f"log-{suffix}",
                timestamp,
                payload.log_level,
                payload.text,
                payload.text,
                payload.optional_text,
            ),
        )
        await conn.execute(
            "INSERT INTO actions VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                action_id,
                payload.text,
                payload.action_type,
                json_value,
                json_value,
                int(payload.enabled),
                payload.optional_text,
                timestamp,
                timestamp,
            ),
        )
        await conn.execute(
            "INSERT INTO action_trigger_history VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                f"history-{suffix}",
                action_id,
                task_id,
                batch_id,
                payload.text,
                payload.action_status,
                payload.optional_text,
                timestamp,
            ),
        )

    await conn.execute(f"PRAGMA user_version={fixture.version}")
    await conn.commit()


# Feature: codebase-simplification-round-2, Property 1
@pytest.mark.traceability(_TRACE_MARKER)
@settings(
    max_examples=_MIN_PROPERTY_EXAMPLES,
    deadline=None,
    suppress_health_check=[HealthCheck.too_slow],
)
@given(case=_schema_classification_cases())
def test_schema_classification_is_complete_and_order_independent(
    case: tuple[SchemaFingerprint, dict[str, SchemaFingerprint]],
) -> None:
    """Feature: codebase-simplification-round-2, Property 1.

    **Validates: Requirements 2.2, 2.4**
    """
    exact, defects = case
    exact_before = _snapshot(exact)

    assert exact == CURRENT_SCHEMA_FINGERPRINT
    assert hash(exact) == hash(CURRENT_SCHEMA_FINGERPRINT)
    _require_current_structure(exact)
    assert _snapshot(exact) == exact_before

    for category, incomplete in defects.items():
        before = _snapshot(incomplete)
        with pytest.raises(SchemaEvolutionError) as caught:
            _require_current_structure(incomplete)

        assert _snapshot(incomplete) == before
        assert _MISMATCH_LABELS[category] in str(caught.value).lower()


async def _snapshot_domain(conn: aiosqlite.Connection) -> dict[str, _TableSnapshot]:
    """Capture primary keys, counts, and every column value for every domain table."""
    snapshot: dict[str, _TableSnapshot] = {}
    for table in sorted(REQUIRED_TABLES):
        info_cursor = await conn.execute(f"PRAGMA table_info({_quote(table)})")
        info = await info_cursor.fetchall()
        await info_cursor.close()
        columns = tuple(str(row[1]) for row in info)
        primary_key_columns = tuple(
            column for _, column in sorted((int(row[5]), str(row[1])) for row in info if int(row[5]))
        )
        select_columns = ", ".join(_quote(column) for column in columns)
        order_columns = ", ".join(_quote(column) for column in primary_key_columns)
        rows_cursor = await conn.execute(f"SELECT {select_columns} FROM {_quote(table)} ORDER BY {order_columns}")
        rows = tuple(tuple(row) for row in await rows_cursor.fetchall())
        await rows_cursor.close()
        column_positions = {column: index for index, column in enumerate(columns)}
        primary_keys = tuple(tuple(row[column_positions[column]] for column in primary_key_columns) for row in rows)
        snapshot[table] = _TableSnapshot(
            columns=columns,
            primary_key_columns=primary_key_columns,
            primary_keys=primary_keys,
            row_count=len(rows),
            rows=rows,
        )
    return snapshot


def _assert_domain_equal(
    expected: dict[str, _TableSnapshot],
    actual: dict[str, _TableSnapshot],
) -> None:
    assert actual.keys() == expected.keys()
    for table, expected_table in expected.items():
        actual_table = actual[table]
        assert actual_table.columns == expected_table.columns, table
        assert actual_table.primary_key_columns == expected_table.primary_key_columns, table
        assert actual_table.primary_keys == expected_table.primary_keys, table
        assert actual_table.row_count == expected_table.row_count, table
        assert actual_table.rows == expected_table.rows, table


# Feature: codebase-simplification-round-2, Property 2
@pytest.mark.traceability("Feature: codebase-simplification-round-2, Property 2")
@settings(max_examples=16, deadline=None)
@given(fixture=_DOMAIN_FIXTURES)
async def test_supported_schema_evaluation_converges_without_data_loss(
    fixture: _DomainFixture,
) -> None:
    """Feature: codebase-simplification-round-2, Property 2.

    **Validates: Requirements 2.3, 2.6**
    """
    conn = await aiosqlite.connect(":memory:")
    try:
        await conn.execute("PRAGMA foreign_keys=ON")
        await _insert_domain_fixture(conn, fixture)
        initial_fingerprint = await inspect_schema(conn)
        initial_domain = await _snapshot_domain(conn)

        await ensure_supported_schema(conn)
        first_fingerprint = await inspect_schema(conn)
        first_domain = await _snapshot_domain(conn)

        await ensure_supported_schema(conn)
        second_fingerprint = await inspect_schema(conn)
        second_domain = await _snapshot_domain(conn)

        assert first_fingerprint.version == CURRENT_SCHEMA_VERSION
        assert second_fingerprint.version == CURRENT_SCHEMA_VERSION
        assert replace(initial_fingerprint, version=CURRENT_SCHEMA_VERSION) == first_fingerprint
        assert first_fingerprint == second_fingerprint == CURRENT_SCHEMA_FINGERPRINT
        _assert_domain_equal(initial_domain, first_domain)
        _assert_domain_equal(first_domain, second_domain)
    finally:
        await conn.close()


async def _closed_logical_snapshot(path: str) -> dict[str, Any]:
    """Observe version, complete SQL inventory, and all values with the reader closed."""
    conn = await aiosqlite.connect(path)
    try:
        version_rows = tuple(await conn.execute_fetchall("PRAGMA user_version"))
        (version_row,) = version_rows
        schema_rows = await conn.execute_fetchall(
            "SELECT type, name, tbl_name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name"
        )
        domain: dict[str, tuple[tuple[Any, ...], ...]] = {}
        for table in sorted(str(row[1]) for row in schema_rows if str(row[0]) == "table"):
            rows = await conn.execute_fetchall(f"SELECT * FROM {_quote(table)}")
            domain[table] = tuple(sorted((tuple(row) for row in rows), key=repr))
        return {
            "version": int(version_row[0]),
            "schema": tuple(tuple(row) for row in schema_rows),
            "domain": domain,
        }
    finally:
        await conn.close()


def _closed_file_snapshot(path: str) -> dict[str, bytes]:
    """Observe main/sidecar presence and bytes only while every connection is closed."""
    return {
        suffix: candidate.read_bytes() for suffix in ("", "-wal", "-shm") if (candidate := Path(path + suffix)).exists()
    }


async def _run_schema_startup(path: str) -> Exception | None:
    from server.db.database import Database, SchemaBaselineError

    caught: SchemaBaselineError | None = None
    database = Database(path)
    await database.connect()
    try:
        try:
            await database.ensure_schema()
        except SchemaBaselineError as exc:
            caught = exc
    finally:
        await database.close()
    return caught


_DUPLICATE_FK_GROUP_CASES = tuple(
    sorted((table, group) for table, groups in CURRENT_SCHEMA_FINGERPRINT.foreign_keys.items() for group in groups)
)
_DUPLICATED_FK_CLAUSE = "    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,"


@pytest.mark.traceability("Feature: duplicate-fk-fingerprint-post-round-3, Property 1")
@settings(max_examples=12, deadline=None)
@given(
    version=st.sampled_from((0, CURRENT_SCHEMA_VERSION)),
    selected=st.sampled_from(_DUPLICATE_FK_GROUP_CASES),
    additional_copies=st.integers(min_value=1, max_value=3),
    seed=st.integers(min_value=0, max_value=2**32 - 1),
)
def test_duplicate_identical_fk_groups_are_rejected(
    version: int,
    selected: tuple[str, ForeignKeyGroupSignature],
    additional_copies: int,
    seed: int,
) -> None:
    """Feature: duplicate-fk-fingerprint-post-round-3, Property 1.

    Construct the bug condition from the exact current manifest: every
    non-FK dimension remains exact, while one existing group G occurs twice
    or more. The sequence oracle retains every copy and permits only outer
    discovery-order permutation. On unfixed code Hypothesis minimizes this to
    ``[G, G]`` and the expected ``foreign keys`` rejection does not occur.

    **Validates: Requirements 1.1, 1.2, 1.5, 2.1, 2.2, 2.3, 2.4**
    """
    expected = CURRENT_SCHEMA_FINGERPRINT
    table, group = selected
    rng = Random(seed)
    observed_foreign_keys = {
        current_table: _shuffled(
            tuple(groups) + ((group,) * additional_copies if current_table == table else ()),
            rng,
        )
        for current_table, groups in expected.foreign_keys.items()
    }

    assert len(observed_foreign_keys[table]) == len(expected.foreign_keys[table]) + additional_copies
    assert set(observed_foreign_keys[table]) == set(expected.foreign_keys[table])

    observed = _fingerprint(
        version=version,
        tables=_shuffled(expected.tables, rng),
        columns=_permuted_mapping(expected.columns, rng),
        indexes=_permuted_mapping(expected.indexes, rng),
        foreign_keys=_permuted_mapping(observed_foreign_keys, rng),
    )
    assert observed.tables == expected.tables
    assert observed.columns == expected.columns
    assert observed.indexes == expected.indexes

    with pytest.raises(SchemaEvolutionError, match="foreign keys"):
        _require_current_structure(observed)


async def _create_duplicate_identical_fk_fixture(path: str, version: int) -> None:
    """Create an exact-name, non-empty schema differing only by one repeated FK clause."""
    assert DDL.count(_DUPLICATED_FK_CLAUSE) == 1
    duplicate_ddl = DDL.replace(
        _DUPLICATED_FK_CLAUSE,
        f"{_DUPLICATED_FK_CLAUSE}\n{_DUPLICATED_FK_CLAUSE}",
        1,
    )
    conn = await aiosqlite.connect(path)
    try:
        await conn.execute("PRAGMA journal_mode=WAL")
        await conn.executescript(duplicate_ddl)
        await conn.execute(
            "INSERT INTO app_logs (id, time, level, category, message, details) VALUES (?, ?, ?, ?, ?, ?)",
            ("duplicate-fk-sentinel", "2026-01-01T00:00:00Z", "info", "schema-test", "preserved", "{}"),
        )
        await conn.execute(f"PRAGMA user_version={version}")
        await conn.commit()
    finally:
        await conn.close()


@pytest.mark.parametrize("version", [0, CURRENT_SCHEMA_VERSION], ids=["version-0", "current-version"])
async def test_duplicate_identical_fk_startup_rejects_without_closed_snapshot_mutation(
    tmp_path: Any,
    version: int,
) -> None:
    """Require real startup rejection and complete post-close preservation.

    Deterministic pre-fix result: both supported versions are falsely accepted;
    version 0 is additionally stamped to the current version. The same test is
    retained unchanged for the post-fix rejection/non-mutation check.

    **Validates: Requirements 1.1, 1.2, 1.5, 2.1, 2.2, 2.3, 2.4**
    """
    path = str(tmp_path / f"duplicate-identical-fk-{version}.db")
    await _create_duplicate_identical_fk_fixture(path, version)
    before_logical = await _closed_logical_snapshot(path)
    before_files = _closed_file_snapshot(path)

    caught = await _run_schema_startup(path)

    after_logical = await _closed_logical_snapshot(path)
    after_files = _closed_file_snapshot(path)
    assert caught is not None, f"duplicate-identical FK database at version {version} was accepted"
    assert "foreign keys" in str(caught).lower()
    assert after_logical == before_logical
    assert after_files == before_files

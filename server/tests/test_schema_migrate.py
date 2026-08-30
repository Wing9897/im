"""Additive migration runner: empty production registry plus injected test-only chain."""

from __future__ import annotations

from pathlib import Path

import aiosqlite
import pytest

from server.db.database import Database, SchemaBaselineError
from server.db.schema_bootstrap import (
    CURRENT_SCHEMA_FINGERPRINT,
    CURRENT_SCHEMA_VERSION,
    SCHEMA_MIGRATIONS,
    SCHEMA_SEMVER,
    ensure_supported_schema,
    inspect_schema,
)
from server.db.schema_inspect import SchemaEvolutionError
from server.db.schema_migrate import MigrationStep, apply_migrations
from server.tests.schema_fixtures import (
    file_snapshot,
    logical_snapshot,
    make_stamp_4_db,
    make_stamped_db,
)


def test_production_registry_is_empty() -> None:
    assert SCHEMA_MIGRATIONS == ()
    assert CURRENT_SCHEMA_VERSION == 6
    assert SCHEMA_SEMVER == "1.5.0"


def _backup_files(directory: Path) -> list[Path]:
    return sorted(path for path in directory.iterdir() if ".pre-stamp-" in path.name and path.suffix == ".db")


async def _make_payload_db(path: str, *, version: int) -> None:
    conn = await aiosqlite.connect(path)
    try:
        await conn.execute("PRAGMA journal_mode=WAL")
        await conn.execute("CREATE TABLE payload (id TEXT PRIMARY KEY, note TEXT NOT NULL)")
        await conn.execute("INSERT INTO payload (id, note) VALUES ('row-1', 'keep-me')")
        await conn.execute(f"PRAGMA user_version={version}")
        await conn.commit()
    finally:
        await conn.close()


def _injected_chain(*, fail_at: int | None = None) -> tuple[MigrationStep, ...]:
    steps: list[MigrationStep] = []

    async def add_column(conn: aiosqlite.Connection, name: str) -> None:
        await conn.execute(f"ALTER TABLE payload ADD COLUMN {name} TEXT")

    async def create_extra(conn: aiosqlite.Connection) -> None:
        await conn.execute("CREATE TABLE extra_v10 (id TEXT PRIMARY KEY)")
        await conn.execute("CREATE INDEX idx_extra_v10_id ON extra_v10 (id)")

    async def boom(_conn: aiosqlite.Connection) -> None:
        raise RuntimeError("injected mid-chain failure")

    for target in range(4, 10):
        column = f"c{target}"
        if fail_at is not None and target == fail_at:
            steps.append(MigrationStep(target=target, apply=boom))
        else:
            steps.append(MigrationStep(target=target, apply=lambda conn, name=column: add_column(conn, name)))
    if fail_at == 10:
        steps.append(MigrationStep(target=10, apply=boom))
    else:
        steps.append(MigrationStep(target=10, apply=create_extra))
    return tuple(steps)


@pytest.mark.asyncio
async def test_stamp_4_is_hard_rejected_without_changes(tmp_path) -> None:
    path = str(tmp_path / "stamp-4-reject.db")
    await make_stamp_4_db(path, log_rows=[("log-v4", "2026-01-01T00:00:00Z", "info", "schema-test")])

    before_logical = await logical_snapshot(path)
    before_file = file_snapshot(path)

    db = Database(path)
    await db.connect()
    try:
        with pytest.raises(
            SchemaBaselineError,
            match=(r"Unsupported database schema version 4.*reset_local_databases.py --apply"),
        ):
            await db.ensure_schema()
        assert await db.fetch_value("PRAGMA user_version") == 4
    finally:
        await db.close()

    assert await logical_snapshot(path) == before_logical
    assert file_snapshot(path) == before_file


@pytest.mark.asyncio
async def test_injected_chain_walks_stamp_3_to_10_and_keeps_rows(tmp_path) -> None:
    path = str(tmp_path / "payload-v3.db")
    await _make_payload_db(path, version=3)
    conn = await aiosqlite.connect(path)
    try:
        await apply_migrations(conn, 3, 10, db_path=path, migrations=_injected_chain())
        version = await (await conn.execute("PRAGMA user_version")).fetchone()
        assert version is not None
        assert int(version[0]) == 10
        note = await (await conn.execute("SELECT note FROM payload WHERE id = 'row-1'")).fetchone()
        assert note is not None and note[0] == "keep-me"
        columns = {str(row[1]) for row in await (await conn.execute("PRAGMA table_info(payload)")).fetchall()}
        assert {"c4", "c5", "c6", "c7", "c8", "c9"} <= columns
        tables = {
            str(row[0])
            for row in await (await conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")).fetchall()
        }
        assert "extra_v10" in tables
    finally:
        await conn.close()


@pytest.mark.asyncio
async def test_mid_chain_failure_stops_at_last_commit_and_keeps_backup(tmp_path) -> None:
    path = str(tmp_path / "payload-fail.db")
    await _make_payload_db(path, version=3)
    conn = await aiosqlite.connect(path)
    try:
        with pytest.raises(SchemaEvolutionError, match="Schema migration to stamp 6 failed"):
            await apply_migrations(conn, 3, 10, db_path=path, migrations=_injected_chain(fail_at=6))
        version = await (await conn.execute("PRAGMA user_version")).fetchone()
        assert version is not None
        assert int(version[0]) == 5
        note = await (await conn.execute("SELECT note FROM payload WHERE id = 'row-1'")).fetchone()
        assert note is not None and note[0] == "keep-me"
        columns = {str(row[1]) for row in await (await conn.execute("PRAGMA table_info(payload)")).fetchall()}
        assert {"c4", "c5"} <= columns
        assert "c6" not in columns
    finally:
        await conn.close()

    backups = _backup_files(tmp_path)
    assert backups, "expected a pre-stamp backup beside the database"
    assert any(".pre-stamp-10." in backup.name for backup in backups)


@pytest.mark.asyncio
async def test_future_stamp_is_rejected_without_file_changes(tmp_path) -> None:
    path = str(tmp_path / "future-stamp.db")
    await make_stamped_db(
        path,
        version=CURRENT_SCHEMA_VERSION + 1,
        log_rows=[("log-future", "2026-01-01T00:00:00Z", "info", "schema-test")],
    )
    before_logical = await logical_snapshot(path)
    before_file = file_snapshot(path)

    db = Database(path)
    await db.connect()
    try:
        with pytest.raises(SchemaBaselineError, match="Update the application"):
            await db.ensure_schema()
        assert await db.fetch_value("PRAGMA user_version") == CURRENT_SCHEMA_VERSION + 1
    finally:
        await db.close()

    assert await logical_snapshot(path) == before_logical
    assert file_snapshot(path) == before_file
    assert _backup_files(tmp_path) == []


@pytest.mark.asyncio
async def test_empty_db_skips_injected_fake_chain(tmp_path) -> None:
    path = str(tmp_path / "empty-skip.db")

    async def explode(_conn: aiosqlite.Connection) -> None:
        raise AssertionError("empty databases must not replay an injected migration chain")

    fake = tuple(MigrationStep(target=target, apply=explode) for target in range(2, 11))
    db = Database(path)
    await db.connect()
    try:
        await ensure_supported_schema(db.conn, db.path, migrations=fake)
        fingerprint = await inspect_schema(db.conn)
        assert fingerprint.version == CURRENT_SCHEMA_VERSION
        assert fingerprint == CURRENT_SCHEMA_FINGERPRINT
    finally:
        await db.close()

    assert _backup_files(tmp_path) == []


@pytest.mark.asyncio
async def test_startup_remaps_leftover_listing_strings(tmp_path) -> None:
    path = str(tmp_path / "listing-remap.db")
    db = Database(path)
    await db.connect()
    try:
        await ensure_supported_schema(db.conn, db.path)
        await db.execute(
            """
            INSERT INTO calendar_share_publish (
                workset_id, slug, public_visibility, grants_json, last_public_visibility
            ) VALUES (?, ?, ?, ?, ?)
            """,
            ("ws-legacy", "Work", "off", "[]", "busy"),
        )
        await ensure_supported_schema(db.conn, db.path)
        row = await db.fetch_one(
            "SELECT public_visibility, last_public_visibility FROM calendar_share_publish WHERE workset_id = ?",
            ("ws-legacy",),
        )
        assert row is not None
        assert str(row["public_visibility"]) == "private_group"
        assert str(row["last_public_visibility"]) == "public_busy"
    finally:
        await db.close()

"""Data migration ledger: one-shot application tracked in ``_data_migrations``."""

from __future__ import annotations

import pytest

import server.db.data_migrations as data_migrations
from server.db.data_migrations import apply_data_migrations
from server.db.database import Database
from server.db.migrations import CURRENT_SCHEMA_FINGERPRINT, inspect_schema


@pytest.fixture
async def db(tmp_path):
    database = Database(str(tmp_path / "data-migration-test.db"))
    await database.connect()
    await database.ensure_schema()
    yield database
    await database.close()


@pytest.mark.asyncio
async def test_empty_registry_still_creates_the_ledger(db: Database):
    """Empty content registry still provisions the ledger on the wipe-only floor."""
    assert data_migrations._MIGRATIONS == ()

    await apply_data_migrations(db)
    await apply_data_migrations(db)

    rows = await db.fetch_all("SELECT id FROM _data_migrations ORDER BY id")
    assert [row["id"] for row in rows] == []


@pytest.mark.asyncio
async def test_injected_migration_runs_once_and_stays_outside_schema_fingerprint(
    db: Database,
    monkeypatch: pytest.MonkeyPatch,
):
    calls: list[str] = []

    async def fake_migration(_db: Database) -> None:
        calls.append("run")

    monkeypatch.setattr(
        data_migrations,
        "_MIGRATIONS",
        (("fake_migration_v1", fake_migration),),
    )
    schema_before = await inspect_schema(db.conn)

    await apply_data_migrations(db)
    await apply_data_migrations(db)

    assert calls == ["run"]
    rows = await db.fetch_all("SELECT id FROM _data_migrations")
    assert [row["id"] for row in rows] == ["fake_migration_v1"]

    # Ledger bookkeeping is excluded from the schema fingerprint and remains
    # valid on the next schema evaluation.
    assert await inspect_schema(db.conn) == schema_before == CURRENT_SCHEMA_FINGERPRINT
    await db.ensure_schema()
    assert await db.fetch_value("SELECT COUNT(*) FROM _data_migrations") == 1

"""Schema upgrade gate: baseline backup + restore + stop-the-world migration UX.

These tests inject fake ``MigrationStep``s to exercise the gate framework itself
(classification, baseline backup, verify marker, auto-heal, and restore).

Live baseline is stamp **v1** with an empty registry, so the fixture invents a
temporary **v1→v2** step (and bumps ``CURRENT_SCHEMA_VERSION`` to 2 for the
duration of each test). That avoids the v0 "exact fingerprint → stamp only"
shortcut, which never invokes ``MigrationStep.apply``／``validate``.
"""

from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

import aiosqlite
import pytest
from httpx import ASGITransport, AsyncClient

import server.db.migrations as migrations
import server.schema_lifecycle as schema_lifecycle_mod
from server.db.backup import (
    backup_database_file,
    cleanup_old_upgrade_backups,
    ensure_upgrade_baseline,
    find_upgrade_baseline,
    quick_check_database,
    restore_database_from_backup,
    upgrade_baseline_path,
)
from server.db.database import Database
from server.db.migrations import CURRENT_SCHEMA_VERSION, MigrationStep, validate_migration_registry
from server.db.post_migration_validate import (
    PostMigrationValidationError,
    assert_post_migration_data,
    capture_pre_migration_snapshot,
    validate_post_migration_data,
)
from server.main import create_app
from server.schema_lifecycle import SchemaLifecycle

# Live product stamp. Gate fixtures invent one fake step beyond it.
_LIVE_CURRENT = CURRENT_SCHEMA_VERSION
_GATE_SOURCE_VERSION = _LIVE_CURRENT
_GATE_TARGET_VERSION = _LIVE_CURRENT + 1


@pytest.fixture
def fake_migration_step(monkeypatch: pytest.MonkeyPatch) -> list[str]:
    """Register a no-op fake ``MigrationStep`` (live current → live+1).

    The test databases already have the exact current structure, so a no-op
    ``apply`` plus the version stamp is a complete, valid upgrade. Returns a
    list recording hook invocations (``apply`` / ``validate``).
    """
    calls: list[str] = []

    async def apply(_conn: aiosqlite.Connection) -> None:
        calls.append("apply")

    async def validate(_conn: aiosqlite.Connection) -> None:
        calls.append("validate")

    registry = validate_migration_registry(
        (MigrationStep(_GATE_SOURCE_VERSION, _GATE_TARGET_VERSION, apply, validate),),
        current_version=_GATE_TARGET_VERSION,
    )
    monkeypatch.setattr(migrations, "SCHEMA_MIGRATIONS", registry)
    monkeypatch.setattr(migrations, "CURRENT_SCHEMA_VERSION", _GATE_TARGET_VERSION)
    # SchemaLifecycle captured CURRENT at import as a dataclass default — wrap
    # __init__ so create_app / direct constructors see the bumped target.
    original_init = SchemaLifecycle.__init__

    def _init_with_target(self: Any, *args: Any, **kwargs: Any) -> None:
        kwargs.setdefault("required_version", _GATE_TARGET_VERSION)
        original_init(self, *args, **kwargs)

    monkeypatch.setattr(SchemaLifecycle, "__init__", _init_with_target)
    monkeypatch.setattr(schema_lifecycle_mod, "CURRENT_SCHEMA_VERSION", _GATE_TARGET_VERSION)
    return calls


def _write_sqlite_file(path: Path, *, marker: str = "ok") -> None:
    conn = sqlite3.connect(str(path))
    try:
        conn.execute("CREATE TABLE IF NOT EXISTS probe (id INTEGER PRIMARY KEY, note TEXT)")
        conn.execute("DELETE FROM probe")
        conn.execute("INSERT INTO probe (id, note) VALUES (1, ?)", (marker,))
        conn.commit()
    finally:
        conn.close()


def _probe_note(path: Path) -> str:
    conn = sqlite3.connect(str(path))
    try:
        row = conn.execute("SELECT note FROM probe WHERE id = 1").fetchone()
        assert row is not None
        return str(row[0])
    finally:
        conn.close()


async def _make_prior_version_db(db_path: Path) -> Database:
    """Create a current-structure database stamped one version behind, with data."""
    db = Database(str(db_path))
    await db.connect()
    await db.ensure_schema()
    await db.execute(f"PRAGMA user_version={_GATE_SOURCE_VERSION}")
    await db.execute(
        "INSERT INTO analysis_tasks "
        "(id, name, prompt_template, analysis_mode, analysis_time_range, version, "
        "is_active, schedule_type, created_at, updated_at) "
        "VALUES ('t1', 'T', '', 'event', 'all', 1, 1, 'seconds_10', "
        "'2026-01-01T00:00:00+00:00', '2026-01-01T00:00:00+00:00')"
    )
    await db.execute(
        "INSERT INTO channels (platform, platform_id, channel_name, created_at) "
        "VALUES ('rss', 'feed-1', 'Feed', '2026-01-01T00:00:00+00:00')"
    )
    await db.execute("INSERT INTO task_channels (task_id, platform, platform_id) VALUES ('t1', 'rss', 'feed-1')")
    return db


@pytest.mark.asyncio
async def test_backup_and_restore_roundtrip(tmp_path):
    db_path = tmp_path / "app.db"
    _write_sqlite_file(db_path, marker="original-db")

    backup = backup_database_file(str(db_path), from_version=1, to_version=2)
    assert backup is not None
    assert "bak-v1-to-v2-" in Path(backup).name
    assert quick_check_database(backup)

    _write_sqlite_file(db_path, marker="corrupted")
    restore_database_from_backup(str(db_path), backup)
    assert _probe_note(db_path) == "original-db"


@pytest.mark.asyncio
async def test_upgrade_baseline_not_overwritten(tmp_path):
    db_path = tmp_path / "app.db"
    _write_sqlite_file(db_path, marker="good-v1")
    first = ensure_upgrade_baseline(str(db_path), from_version=1, to_version=2)
    assert first is not None
    assert _probe_note(Path(first)) == "good-v1"

    _write_sqlite_file(db_path, marker="damaged")
    second = ensure_upgrade_baseline(str(db_path), from_version=1, to_version=2)
    assert second == first
    assert _probe_note(Path(first)) == "good-v1"
    assert find_upgrade_baseline(str(db_path), from_version=1, to_version=2) == first
    assert upgrade_baseline_path(str(db_path), 1, 2).exists()


@pytest.mark.asyncio
async def test_truncated_baseline_rejected_and_rebuilt(tmp_path):
    db_path = tmp_path / "app.db"
    _write_sqlite_file(db_path, marker="live-good")
    baseline = ensure_upgrade_baseline(str(db_path), from_version=1, to_version=2)
    assert baseline is not None
    Path(baseline).write_bytes(b"SQLite format 3\x00truncated-junk")
    assert quick_check_database(baseline) is False

    _write_sqlite_file(db_path, marker="live-after")
    rebuilt = ensure_upgrade_baseline(str(db_path), from_version=1, to_version=2)
    assert rebuilt == baseline
    assert quick_check_database(baseline)
    assert _probe_note(Path(baseline)) == "live-after"


@pytest.mark.asyncio
async def test_atomic_restore_rejects_bad_backup_without_touching_live(tmp_path):
    db_path = tmp_path / "app.db"
    _write_sqlite_file(db_path, marker="live-safe")
    bad_backup = tmp_path / "bad.bak.db"
    bad_backup.write_bytes(b"not-a-sqlite-database")

    with pytest.raises(RuntimeError, match="quick_check"):
        restore_database_from_backup(str(db_path), str(bad_backup))

    assert _probe_note(db_path) == "live-safe"
    staging = tmp_path / "app.restore-staging.db"
    assert not staging.exists()


@pytest.mark.asyncio
async def test_cleanup_purges_timestamped_keeps_baseline(tmp_path):
    db_path = tmp_path / "app.db"
    _write_sqlite_file(db_path, marker="live")
    baseline = ensure_upgrade_baseline(str(db_path), from_version=1, to_version=2)
    assert baseline is not None
    for stamp in ("20260101-010101", "20260101-020202", "20260101-030303"):
        dest = tmp_path / f"app.bak-v1-to-v2-{stamp}.db"
        _write_sqlite_file(dest, marker="old")
    deleted = cleanup_old_upgrade_backups(str(db_path))
    assert Path(baseline).exists()
    timestamped = [p for p in tmp_path.glob("app.bak-v1-to-v2-*.db") if "baseline" not in p.name]
    assert timestamped == []
    assert len(deleted) == 3


@pytest.mark.asyncio
async def test_startup_verify_marker_restores_damaged_stamp(tmp_path, fake_migration_step):
    """Stamp succeeded, validate never ran → marker present → startup restores."""
    from server.db.upgrade_marker import write_upgrade_verify_marker

    db_path = tmp_path / "stamp-crash.db"
    db = await _make_prior_version_db(db_path)
    await db.conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    await db.conn.commit()
    before = await capture_pre_migration_snapshot(db.conn)
    baseline = ensure_upgrade_baseline(
        str(db_path),
        from_version=_GATE_SOURCE_VERSION,
        to_version=_GATE_TARGET_VERSION,
    )
    assert baseline is not None
    write_upgrade_verify_marker(
        str(db_path),
        from_version=_GATE_SOURCE_VERSION,
        to_version=_GATE_TARGET_VERSION,
        baseline_path=baseline,
        snapshot=before,
    )
    # Simulate stamp-without-validate + data loss.
    await db.execute(f"PRAGMA user_version={_GATE_TARGET_VERSION}")
    await db.execute("DELETE FROM task_channels")
    await db.close()

    lifecycle = SchemaLifecycle(db=Database(str(db_path)))
    await lifecycle.db.connect()
    await lifecycle.classify()
    assert lifecycle.state == "ready"  # stamped current before verify
    await lifecycle.verify_after_stamp_or_ready()
    assert lifecycle.state == "needs_upgrade"
    assert lifecycle.restored_from_backup is True
    links = await lifecycle.db.fetch_all("SELECT * FROM task_channels")
    assert len(links) == 1
    await lifecycle.db.close()


@pytest.mark.asyncio
async def test_startup_auto_heals_needs_upgrade_with_marker_and_baseline(tmp_path, fake_migration_step):
    """Half-migrate crash: still prior version, marker+baseline present → classify heal restores."""
    from server.db.upgrade_marker import write_upgrade_verify_marker

    db_path = tmp_path / "half-migrate.db"
    db = await _make_prior_version_db(db_path)
    await db.conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    await db.conn.commit()
    before = await capture_pre_migration_snapshot(db.conn)
    baseline = ensure_upgrade_baseline(
        str(db_path),
        from_version=_GATE_SOURCE_VERSION,
        to_version=_GATE_TARGET_VERSION,
    )
    assert baseline is not None
    write_upgrade_verify_marker(
        str(db_path),
        from_version=_GATE_SOURCE_VERSION,
        to_version=_GATE_TARGET_VERSION,
        baseline_path=baseline,
        snapshot=before,
    )
    # Damage live mid-migrate while still below current.
    await db.execute("DELETE FROM task_channels")
    await db.close()

    lifecycle = SchemaLifecycle(db=Database(str(db_path)))
    await lifecycle.db.connect()
    await lifecycle.classify()
    assert lifecycle.state == "needs_upgrade"
    await lifecycle.heal_half_migrated_if_needed()
    assert lifecycle.state == "needs_upgrade"
    assert lifecycle.restored_from_backup is True
    links = await lifecycle.db.fetch_all("SELECT * FROM task_channels")
    assert len(links) == 1
    snap = lifecycle.snapshot()
    assert snap["progress"]["phase"] == "awaiting_confirmation"
    assert "phaseLabel" not in snap["progress"]
    assert snap["progress"]["message"] == "healed_half_migration"
    await lifecycle.db.close()


@pytest.mark.asyncio
async def test_post_migration_validate_detects_channel_loss(tmp_path):
    db = await _make_prior_version_db(tmp_path / "channel-loss.db")
    try:
        before = await capture_pre_migration_snapshot(db.conn)
        assert before.task_channels == 1
        assert await validate_post_migration_data(db.conn, before) == []

        await db.execute("DELETE FROM task_channels")
        failures = await validate_post_migration_data(db.conn, before)
        assert any("task_channels" in f for f in failures)
        with pytest.raises(PostMigrationValidationError, match="task_channels"):
            await assert_post_migration_data(db.conn, before)
    finally:
        await db.close()


@pytest.mark.asyncio
async def test_upgrade_failure_auto_restores_and_stays_gated(tmp_path, fake_migration_step):
    db_path = tmp_path / "validate-fail.db"
    db = await _make_prior_version_db(db_path)
    await db.close()

    lifecycle = SchemaLifecycle(db=Database(str(db_path)))
    await lifecycle.db.connect()
    await lifecycle.classify()
    assert lifecycle.state == "needs_upgrade"

    runtime_started = False

    async def finish_runtime() -> None:
        nonlocal runtime_started
        runtime_started = True

    lifecycle.bind_finish_runtime(finish_runtime)

    original_ensure = lifecycle.db.ensure_schema

    async def ensure_then_break() -> None:
        await original_ensure()
        await lifecycle.db.execute("DELETE FROM task_channels")

    lifecycle.db.ensure_schema = ensure_then_break  # type: ignore[method-assign]
    snapshot = await lifecycle.run_upgrade()

    assert snapshot["runtimeReady"] is False
    assert snapshot["state"] == "needs_upgrade"
    assert snapshot["restoredFromBackup"] is True
    assert "task_channels" in (snapshot["error"] or "")
    assert snapshot["backupPath"]
    assert "baseline" in Path(snapshot["backupPath"]).name
    assert runtime_started is False

    links = await lifecycle.db.fetch_all("SELECT * FROM task_channels")
    assert len(links) == 1
    version = await (await lifecycle.db.conn.execute("PRAGMA user_version")).fetchone()
    assert version is not None
    assert int(version[0]) == _GATE_SOURCE_VERSION
    await lifecycle.db.close()


@pytest.mark.asyncio
async def test_crash_mid_upgrade_retry_uses_baseline(tmp_path, fake_migration_step):
    """Simulate process restart: baseline on disk, live DB damaged, no in-memory path."""
    db_path = tmp_path / "crash-retry.db"
    db = await _make_prior_version_db(db_path)
    await db.conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    await db.conn.commit()

    baseline = ensure_upgrade_baseline(
        str(db_path),
        from_version=_GATE_SOURCE_VERSION,
        to_version=_GATE_TARGET_VERSION,
    )
    assert baseline is not None

    # Damage live after baseline (as a crash mid-migrate would).
    await db.execute("DELETE FROM task_channels")
    await db.close()

    # Fresh lifecycle like a process restart (backup_path not in memory).
    lifecycle = SchemaLifecycle(db=Database(str(db_path)))
    await lifecycle.db.connect()
    await lifecycle.classify()
    assert lifecycle.state == "needs_upgrade"
    assert lifecycle.backup_path == baseline

    snapshot = await lifecycle.run_upgrade()
    assert snapshot["state"] == "ready"
    assert snapshot["runtimeReady"] is True
    links = await lifecycle.db.fetch_all("SELECT * FROM task_channels")
    assert len(links) == 1
    assert "apply" in fake_migration_step
    assert "validate" in fake_migration_step
    await lifecycle.db.close()


@pytest.mark.asyncio
async def test_schema_upgrade_gate_blocks_then_unlocks(tmp_path, fake_migration_step):
    db_path = tmp_path / "upgrade-gate.db"
    db = await _make_prior_version_db(db_path)
    await db.close()

    app = create_app(
        db_path=str(db_path),
        start_collector=False,
        start_scheduler=False,
        serve_static=False,
    )
    async with app.router.lifespan_context(app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://testserver") as client:
            health = await client.get("/api/v1/health")
            assert health.status_code == 200
            body = health.json()
            assert body["status"] == "needs_upgrade"
            assert body["runtimeReady"] is False

            blocked = await client.get("/api/v1/results/events")
            assert blocked.status_code == 503
            blocked_body = blocked.json()
            assert blocked_body["error_code"] == "SCHEMA_UPGRADE_REQUIRED"
            assert "correlation_id" in blocked_body
            assert isinstance(blocked_body.get("details"), dict)
            assert blocked_body["details"].get("runtimeReady") is False
            assert blocked_body["details"].get("state") == "needs_upgrade"

            status = await client.get("/api/v1/system/schema/status")
            assert status.status_code == 200
            assert status.json()["state"] == "needs_upgrade"

            upgraded = await client.post("/api/v1/system/schema/upgrade")
            assert upgraded.status_code == 200
            payload = upgraded.json()
            assert payload["state"] == "ready"
            assert payload["runtimeReady"] is True
            assert payload["schemaVersion"] == _GATE_TARGET_VERSION
            assert payload["backupPath"]
            assert "baseline" in Path(payload["backupPath"]).name
            assert fake_migration_step == ["apply", "validate"]

            health2 = await client.get("/api/v1/health")
            assert health2.json()["status"] == "ok"
            assert health2.json()["runtimeReady"] is True

            ok = await client.get("/api/v1/results/events")
            assert ok.status_code == 200

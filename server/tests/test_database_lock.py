"""Database concurrency tests."""

from __future__ import annotations

import asyncio

import pytest

from server.db.database import Database
from server.util import new_id, utc_now_iso


@pytest.fixture
async def db(app):
    return app.state.db


@pytest.mark.asyncio
async def test_concurrent_transactions_do_not_nested_begin(db: Database) -> None:
    """Parallel batch paths must not raise 'transaction within a transaction'."""
    task_id = new_id()
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO analysis_tasks "
        "(id, name, prompt_template, analysis_mode, analysis_time_range, "
        "schedule_type, version, is_active, created_at, updated_at) "
        "VALUES (?, ?, ?, 'event', 'all', 'custom_seconds', 1, 1, ?, ?)",
        (task_id, "lock-test", "prompt", now, now),
    )

    async def write_batch(suffix: str) -> None:
        batch_id = new_id()
        async with db.transaction() as conn:
            await asyncio.sleep(0.02)
            await conn.execute(
                "INSERT INTO analysis_batches "
                "(id, task_id, version, status, message_count, created_at, updated_at) "
                "VALUES (?, ?, 1, 'pending', 0, ?, ?)",
                (batch_id, task_id, now, now),
            )

    await asyncio.gather(write_batch("a"), write_batch("b"))

    count = await db.fetch_value("SELECT COUNT(*) FROM analysis_batches WHERE task_id = ?", (task_id,))
    assert int(count or 0) == 2


@pytest.mark.asyncio
async def test_execute_returns_rowcount(db: Database) -> None:
    """Database.execute reports affected rows so callers can detect dedup skips."""
    now = utc_now_iso()
    await db.execute(
        "INSERT OR IGNORE INTO channels (platform, platform_id, channel_name, created_at) VALUES (?, ?, ?, ?)",
        ("telegram", "lock-ch-1", "chan", now),
    )
    message_id = new_id()
    params = (message_id, "telegram", "lock-ch-1", "pm-1", "hello", now, now)
    sql = (
        "INSERT OR IGNORE INTO messages "
        "(id, platform, platform_id, platform_message_id, content, timestamp, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    assert await db.execute(sql, params) == 1
    # Same unique triple → dedup ignore → rowcount 0.
    dup = (new_id(), "telegram", "lock-ch-1", "pm-1", "hello again", now, now)
    assert await db.execute(sql, dup) == 0


@pytest.mark.asyncio
async def test_concurrent_ingest_and_transaction_serialize(db: Database) -> None:
    """Locked single-statement writes interleaved with transactions must not clash."""
    now = utc_now_iso()
    await db.execute(
        "INSERT OR IGNORE INTO channels (platform, platform_id, channel_name, created_at) VALUES (?, ?, ?, ?)",
        ("telegram", "lock-ch-2", "chan2", now),
    )

    async def ingest(index: int) -> None:
        await db.execute(
            "INSERT OR IGNORE INTO messages "
            "(id, platform, platform_id, platform_message_id, content, timestamp, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (new_id(), "telegram", "lock-ch-2", f"pm-c-{index}", "msg", now, now),
        )

    async def long_transaction() -> None:
        async with db.transaction() as conn:
            await asyncio.sleep(0.02)
            await conn.execute(
                "INSERT INTO app_logs (id, time, level, category, message) VALUES (?, ?, 'info', 'system', 'tx')",
                (new_id(), now),
            )

    await asyncio.gather(*(ingest(i) for i in range(5)), long_transaction(), long_transaction())

    count = await db.fetch_value(
        "SELECT COUNT(*) FROM messages WHERE platform_id = 'lock-ch-2'",
    )
    assert int(count or 0) == 5


@pytest.mark.asyncio
async def test_transaction_rolls_back_when_commit_fails(db: Database, monkeypatch) -> None:
    """A failed commit must not leak an open or partially applied transaction."""
    from unittest.mock import AsyncMock

    original_commit = db.conn.commit
    rollback = AsyncMock(wraps=db.conn.rollback)
    monkeypatch.setattr(db.conn, "commit", AsyncMock(side_effect=RuntimeError("commit failed")))
    monkeypatch.setattr(db.conn, "rollback", rollback)

    with pytest.raises(RuntimeError, match="commit failed"):
        async with db.transaction() as conn:
            await conn.execute(
                "INSERT INTO app_logs (id, time, level, category, message) "
                "VALUES (?, ?, 'info', 'system', 'commit failure')",
                (new_id(), utc_now_iso()),
            )

    rollback.assert_awaited_once()
    monkeypatch.setattr(db.conn, "commit", original_commit)
    count = await db.fetch_value("SELECT COUNT(*) FROM app_logs WHERE message = 'commit failure'")
    assert int(count or 0) == 0


@pytest.mark.asyncio
async def test_nested_transaction_fails_fast_in_same_task(db: Database) -> None:
    async with db.transaction():
        with pytest.raises(RuntimeError, match="cannot be nested"):
            async with db.transaction():
                pass

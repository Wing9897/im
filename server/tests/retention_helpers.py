"""Shared helpers for retention cleanup tests."""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest

from server.db.database import Database
from server.tests.db_helpers import insert_channel, insert_direct_analysis_task
from server.util import utc_now_iso


@pytest.fixture
async def db(tmp_path) -> AsyncIterator[Database]:
    database = Database(str(tmp_path / "retention-test.db"))
    await database.connect()
    await database.ensure_schema()
    yield database
    await database.close()


async def seed_channel(db: Database, platform: str = "rss", platform_id: str = "feed-1") -> None:
    await insert_channel(db, platform, platform_id, channel_name="Test Feed")


async def insert_message(
    db: Database,
    message_id: str,
    *,
    timestamp: str,
    platform: str = "rss",
    platform_id: str = "feed-1",
) -> None:
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO messages (id, platform, platform_id, content, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (message_id, platform, platform_id, "hello", timestamp, now),
    )


async def seed_task_and_batch(db: Database) -> None:
    now = utc_now_iso()
    await insert_direct_analysis_task(
        db,
        "task-1",
        analysis_mode="intel_event",
        name="Task",
        prompt_template="prompt",
        schedule_rrule="FREQ=SECONDLY;INTERVAL=10",
    )
    await db.execute(
        "INSERT INTO analysis_batches (id, task_id, version, status, message_count, retry_count, "
        "created_at, updated_at) VALUES (?, ?, 1, 'completed', 1, 0, ?, ?)",
        ("batch-1", "task-1", now, now),
    )


async def insert_device_session(
    db: Database,
    session_id: str,
    *,
    expires_at: str,
    revoked_at: str | None = None,
) -> None:
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO device_sessions (id, label, refresh_token_hash, created_at, last_seen_at, "
        "expires_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (session_id, "Device", f"refresh-{session_id}", now, now, expires_at, revoked_at),
    )


async def insert_access_token(db: Database, token_id: str, session_id: str, *, expires_at: str) -> None:
    await db.execute(
        "INSERT INTO device_access_tokens (id, session_id, token_hash, created_at, expires_at, revoked_at) "
        "VALUES (?, ?, ?, ?, ?, NULL)",
        (token_id, session_id, f"access-{token_id}", utc_now_iso(), expires_at),
    )

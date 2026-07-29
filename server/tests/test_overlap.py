"""Unit tests for server/analyzer/overlap.py."""

from __future__ import annotations

from typing import Any, AsyncIterator

import pytest

from server.analyzer.overlap import fetch_overlap_context
from server.db.database import Database
from server.util import new_id, utc_now_iso


@pytest.fixture
async def db(tmp_path) -> AsyncIterator[Database]:
    database = Database(str(tmp_path / "overlap-test.db"))
    await database.connect()
    await database.ensure_schema()
    yield database
    await database.close()


async def _seed_overlap_fixture(
    db: Database,
    *,
    task_id: str,
    batch_id: str,
    analysis_mode: str = "event",
) -> list[str]:
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO channels (platform, platform_id, channel_name, created_at) VALUES (?, ?, ?, ?)",
        ("rss", "feed-1", "Feed", now),
    )
    await db.execute(
        "INSERT INTO analysis_tasks (id, name, prompt_template, analysis_mode, analysis_time_range, "
        "version, is_active, schedule_type, created_at, updated_at) VALUES (?, ?, ?, ?, 'all', 1, 1, "
        "'seconds_10', ?, ?)",
        (task_id, "Overlap Task", "prompt", analysis_mode, now, now),
    )
    await db.execute(
        "INSERT INTO analysis_batches (id, task_id, version, status, message_count, retry_count, "
        "created_at, updated_at, completed_at) VALUES (?, ?, 1, 'completed', 3, 0, ?, ?, ?)",
        (batch_id, task_id, now, now, now),
    )

    message_ids: list[str] = []
    timestamps = [
        "2026-01-01T10:00:00+00:00",
        "2026-01-01T11:00:00+00:00",
        "2026-01-01T12:00:00+00:00",
    ]
    for index, timestamp in enumerate(timestamps):
        message_id = f"msg-{index}"
        message_ids.append(message_id)
        await db.execute(
            "INSERT INTO messages (id, platform, platform_id, content, timestamp, created_at) "
            "VALUES (?, 'rss', 'feed-1', ?, ?, ?)",
            (message_id, f"content-{index}", timestamp, now),
        )
        await db.execute(
            "INSERT INTO analysis_markers (id, message_id, task_id, version, batch_id, analyzed_at) "
            "VALUES (?, ?, ?, 1, ?, ?)",
            (new_id(), message_id, task_id, batch_id, now),
        )
    return message_ids


async def test_fetch_overlap_context_returns_empty_for_leaderboard_mode(db: Database) -> None:
    task_id = new_id()
    batch_id = new_id()
    await _seed_overlap_fixture(db, task_id=task_id, batch_id=batch_id, analysis_mode="leaderboard")
    task = await db.fetch_one("SELECT * FROM analysis_tasks WHERE id = ?", (task_id,))

    result = await fetch_overlap_context(db, task, overlap_count=2)

    assert result == []


@pytest.mark.parametrize("overlap_count", [0, -1, "bad"])
async def test_fetch_overlap_context_returns_empty_for_invalid_overlap_count(
    db: Database,
    overlap_count: Any,
) -> None:
    task_id = new_id()
    batch_id = new_id()
    await _seed_overlap_fixture(db, task_id=task_id, batch_id=batch_id)
    task = await db.fetch_one("SELECT * FROM analysis_tasks WHERE id = ?", (task_id,))

    result = await fetch_overlap_context(db, task, overlap_count=overlap_count)

    assert result == []


async def test_fetch_overlap_context_returns_empty_without_completed_batch(db: Database) -> None:
    now = utc_now_iso()
    task_id = new_id()
    await db.execute(
        "INSERT INTO analysis_tasks (id, name, prompt_template, analysis_mode, analysis_time_range, "
        "version, is_active, schedule_type, created_at, updated_at) VALUES (?, ?, ?, 'event', "
        "'all', 1, 1, 'seconds_10', ?, ?)",
        (task_id, "No Batch", "prompt", now, now),
    )
    task = await db.fetch_one("SELECT * FROM analysis_tasks WHERE id = ?", (task_id,))

    result = await fetch_overlap_context(db, task, overlap_count=2)

    assert result == []


async def test_fetch_overlap_context_returns_tail_in_timestamp_order(db: Database) -> None:
    task_id = new_id()
    batch_id = new_id()
    message_ids = await _seed_overlap_fixture(db, task_id=task_id, batch_id=batch_id)
    task = await db.fetch_one("SELECT * FROM analysis_tasks WHERE id = ?", (task_id,))

    result = await fetch_overlap_context(db, task, overlap_count=2)

    assert [row["id"] for row in result] == message_ids[-2:]
    assert result[0]["timestamp"] <= result[1]["timestamp"]

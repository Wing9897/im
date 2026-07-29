"""Focused tests for result-store performance changes."""

from __future__ import annotations

import pytest

from server.scheduler.result_store.events import event_key_for, store_analysis_events
from server.tests import seed
from server.util import utc_now_iso


@pytest.fixture
async def db(app):
    return app.state.db


async def test_analysis_events_upsert_updates_existing(db):
    """INSERT ON CONFLICT updates the same event_key without creating a duplicate row."""
    task = await db.fetch_one("SELECT * FROM analysis_tasks WHERE id = ?", (seed.TASK_EVENT_TIMED,))
    assert task is not None
    task_id = str(task["id"])
    version = int(task["version"])
    batch_id = seed.BATCH_EVENT_TIMED
    now = utc_now_iso()
    title = "性能測試會議"
    start_time = "2026-08-01T09:00:00+00:00"
    event_key = event_key_for(title, start_time)

    async with db.transaction() as conn:
        await store_analysis_events(
            conn,
            task_id,
            version,
            batch_id,
            [{"title": title, "summary": "first pass", "start_time": start_time, "participants": ["A"]}],
            [],
            now,
        )

    before_count = int(
        await db.fetch_value(
            "SELECT COUNT(*) FROM analysis_events WHERE task_id = ? AND version = ? AND event_key = ?",
            (task_id, version, event_key),
        )
        or 0
    )
    assert before_count == 1

    async with db.transaction() as conn:
        await store_analysis_events(
            conn,
            task_id,
            version,
            batch_id,
            [{"title": title, "summary": "second pass", "start_time": start_time, "participants": ["B"]}],
            [],
            now,
        )

    after_count = int(
        await db.fetch_value(
            "SELECT COUNT(*) FROM analysis_events WHERE task_id = ? AND version = ? AND event_key = ?",
            (task_id, version, event_key),
        )
        or 0
    )
    assert after_count == before_count

    updated = await db.fetch_one(
        "SELECT body, participants_json FROM analysis_events WHERE task_id = ? AND version = ? AND event_key = ?",
        (task_id, version, event_key),
    )
    assert updated is not None
    assert updated["body"] == "second pass"
    assert "B" in updated["participants_json"]

"""Startup orphan-batch recovery."""

from __future__ import annotations

import pytest

from server.config import set_configs
from server.scheduler.batch_failure import decide_batch_error_outcome
from server.scheduler.manager import SchedulerManager
from server.sse import SseBroadcaster
from server.tests import seed
from server.util import new_id, utc_now_iso


@pytest.fixture
async def db(app):
    return app.state.db


async def test_processing_batches_reset_to_pending_on_recovery(db):
    batch_id = new_id()
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO analysis_batches "
        "(id, task_id, version, status, message_count, created_at, updated_at) "
        "VALUES (?, ?, 1, 'processing', 0, ?, ?)",
        (batch_id, seed.TASK_LEADERBOARD, now, now),
    )

    manager = SchedulerManager(db, analysis_engine=None, broadcaster=SseBroadcaster())
    await manager.recover_orphan_batches()

    row = await db.fetch_one("SELECT status FROM analysis_batches WHERE id = ?", (batch_id,))
    assert row is not None
    assert row["status"] == "pending"


async def test_stalled_pending_batch_uses_same_retry_outcome_as_failure_handler(db):
    await set_configs(db, {"max_batch_retries": "3", "llm_generation_timeout": "60"})
    batch_id = new_id()
    stale_time = utc_now_iso()
    await db.execute(
        "INSERT INTO analysis_batches "
        "(id, task_id, version, status, message_count, retry_count, created_at, updated_at) "
        "VALUES (?, ?, 1, 'pending', 1, 1, ?, ?)",
        (batch_id, seed.TASK_LEADERBOARD, stale_time, stale_time),
    )
    await db.execute(
        "UPDATE analysis_batches SET updated_at = datetime('now', '-300 seconds') WHERE id = ?",
        (batch_id,),
    )

    manager = SchedulerManager(db, analysis_engine=None, broadcaster=SseBroadcaster())
    await manager.recover_orphan_batches()

    row = await db.fetch_one("SELECT retry_count FROM analysis_batches WHERE id = ?", (batch_id,))
    assert row is not None
    expected = decide_batch_error_outcome("", 1, 3)
    assert int(row["retry_count"] or 0) == expected.next_retry


async def test_stalled_pending_batch_resets_retry_when_exhausted(db):
    await set_configs(db, {"max_batch_retries": "2", "llm_generation_timeout": "60"})
    batch_id = new_id()
    stale_time = utc_now_iso()
    await db.execute(
        "INSERT INTO analysis_batches "
        "(id, task_id, version, status, message_count, retry_count, created_at, updated_at) "
        "VALUES (?, ?, 1, 'pending', 1, 1, ?, ?)",
        (batch_id, seed.TASK_LEADERBOARD, stale_time, stale_time),
    )
    await db.execute(
        "UPDATE analysis_batches SET updated_at = datetime('now', '-300 seconds') WHERE id = ?",
        (batch_id,),
    )

    manager = SchedulerManager(db, analysis_engine=None, broadcaster=SseBroadcaster())
    await manager.recover_orphan_batches()

    row = await db.fetch_one("SELECT retry_count FROM analysis_batches WHERE id = ?", (batch_id,))
    assert row is not None
    expected = decide_batch_error_outcome("", 1, 2)
    assert expected.retries_exhausted is True
    assert int(row["retry_count"] or 0) == 0


async def test_stalled_pending_batch_auto_pauses_when_retries_exhausted(db):
    await set_configs(
        db,
        {
            "max_batch_retries": "2",
            "llm_generation_timeout": "60",
            "auto_pause_on_retries_exhausted": "true",
        },
    )
    batch_id = new_id()
    stale_time = utc_now_iso()
    await db.execute(
        "INSERT INTO analysis_batches "
        "(id, task_id, version, status, message_count, retry_count, created_at, updated_at) "
        "VALUES (?, ?, 1, 'pending', 1, 1, ?, ?)",
        (batch_id, seed.TASK_LEADERBOARD, stale_time, stale_time),
    )
    await db.execute(
        "UPDATE analysis_batches SET updated_at = datetime('now', '-300 seconds') WHERE id = ?",
        (batch_id,),
    )

    manager = SchedulerManager(db, analysis_engine=None, broadcaster=SseBroadcaster())
    await manager.recover_orphan_batches()

    paused = await db.fetch_value("SELECT value FROM system_config WHERE key = 'analysis_paused'")
    assert paused == "true"


async def test_skips_stale_pending_sweep_when_analysis_paused(db):
    await set_configs(
        db,
        {
            "max_batch_retries": "2",
            "llm_generation_timeout": "60",
            "auto_pause_on_retries_exhausted": "true",
            "analysis_paused": "true",
        },
    )
    batch_id = new_id()
    stale_time = utc_now_iso()
    await db.execute(
        "INSERT INTO analysis_batches "
        "(id, task_id, version, status, message_count, retry_count, created_at, updated_at) "
        "VALUES (?, ?, 1, 'pending', 1, 1, ?, ?)",
        (batch_id, seed.TASK_LEADERBOARD, stale_time, stale_time),
    )
    await db.execute(
        "UPDATE analysis_batches SET updated_at = datetime('now', '-300 seconds') WHERE id = ?",
        (batch_id,),
    )

    manager = SchedulerManager(db, analysis_engine=None, broadcaster=SseBroadcaster())
    await manager.recover_orphan_batches()

    row = await db.fetch_one(
        "SELECT status, retry_count FROM analysis_batches WHERE id = ?",
        (batch_id,),
    )
    assert row is not None
    assert row["status"] == "pending"
    assert int(row["retry_count"] or 0) == 1


async def test_processing_reset_still_runs_when_analysis_paused(db):
    await set_configs(db, {"analysis_paused": "true"})
    batch_id = new_id()
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO analysis_batches "
        "(id, task_id, version, status, message_count, created_at, updated_at) "
        "VALUES (?, ?, 1, 'processing', 0, ?, ?)",
        (batch_id, seed.TASK_LEADERBOARD, now, now),
    )

    manager = SchedulerManager(db, analysis_engine=None, broadcaster=SseBroadcaster())
    await manager.recover_orphan_batches()

    row = await db.fetch_one("SELECT status FROM analysis_batches WHERE id = ?", (batch_id,))
    assert row is not None
    assert row["status"] == "pending"


@pytest.mark.asyncio
async def test_project_processing_orphan_completes_without_auto_pause(db):
    """Project mid-drain must not enter pending retry / global auto-pause."""
    from server.db.database import TransactionDb
    from server.queries.tasks_queries import insert_analysis_task

    await set_configs(
        db,
        {
            "max_batch_retries": "1",
            "llm_generation_timeout": "60",
            "auto_pause_on_retries_exhausted": "true",
        },
    )
    task_id = new_id()
    now = utc_now_iso()
    async with db.transaction() as conn:
        await insert_analysis_task(
            TransactionDb(conn),
            task_id=task_id,
            name="PM orphan",
            description=None,
            prompt_template="goals",
            analysis_mode="project",
            analysis_time_range="all",
            schedule_type="hourly",
            schedule_value=None,
            rrule=None,
            event_start_time=None,
            event_end_time=None,
            event_is_all_day=0,
            event_location=None,
            event_description=None,
            now=now,
        )
    batch_id = new_id()
    await db.execute(
        "INSERT INTO analysis_batches "
        "(id, task_id, version, status, message_count, retry_count, created_at, updated_at) "
        "VALUES (?, ?, 1, 'processing', 80, 0, ?, ?)",
        (batch_id, task_id, now, now),
    )
    await db.execute(
        "UPDATE analysis_batches SET updated_at = datetime('now', '-300 seconds') WHERE id = ?",
        (batch_id,),
    )

    manager = SchedulerManager(db, analysis_engine=None, broadcaster=SseBroadcaster())
    await manager.recover_orphan_batches()

    row = await db.fetch_one(
        "SELECT status, error_message, message_count, completed_at FROM analysis_batches WHERE id = ?",
        (batch_id,),
    )
    assert row is not None
    assert row["status"] == "completed"
    assert "interrupted" in str(row["error_message"] or "")
    assert int(row["message_count"] or 0) == 80
    assert row["completed_at"] is not None
    paused = await db.fetch_value("SELECT value FROM system_config WHERE key = 'analysis_paused'")
    assert paused != "true"


@pytest.mark.asyncio
async def test_stale_project_pending_does_not_enter_retry_sweep(db):
    from server.db.database import TransactionDb
    from server.queries.tasks_queries import insert_analysis_task

    await set_configs(
        db,
        {
            "max_batch_retries": "1",
            "llm_generation_timeout": "60",
            "auto_pause_on_retries_exhausted": "true",
        },
    )
    task_id = new_id()
    now = utc_now_iso()
    async with db.transaction() as conn:
        await insert_analysis_task(
            TransactionDb(conn),
            task_id=task_id,
            name="PM pending",
            description=None,
            prompt_template="goals",
            analysis_mode="project",
            analysis_time_range="all",
            schedule_type="hourly",
            schedule_value=None,
            rrule=None,
            event_start_time=None,
            event_end_time=None,
            event_is_all_day=0,
            event_location=None,
            event_description=None,
            now=now,
        )
    batch_id = new_id()
    await db.execute(
        "INSERT INTO analysis_batches "
        "(id, task_id, version, status, message_count, retry_count, created_at, updated_at) "
        "VALUES (?, ?, 1, 'pending', 1, 0, ?, ?)",
        (batch_id, task_id, now, now),
    )
    await db.execute(
        "UPDATE analysis_batches SET updated_at = datetime('now', '-300 seconds') WHERE id = ?",
        (batch_id,),
    )

    manager = SchedulerManager(db, analysis_engine=None, broadcaster=SseBroadcaster())
    await manager.recover_orphan_batches()

    row = await db.fetch_one(
        "SELECT status, retry_count FROM analysis_batches WHERE id = ?",
        (batch_id,),
    )
    assert row is not None
    assert row["status"] == "pending"
    assert int(row["retry_count"] or 0) == 0
    paused = await db.fetch_value("SELECT value FROM system_config WHERE key = 'analysis_paused'")
    assert paused != "true"

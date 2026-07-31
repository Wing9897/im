"""Property coverage for atomic rejection of analysis-task RRULE writes."""

from __future__ import annotations

from typing import Any

from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from server.analyzer.geocoding import backfill_stored_events
from server.tests import seed
from server.tests.contract_helpers import assert_keys
from server.tests.property_strategies import (
    MIN_PROPERTY_EXAMPLES,
    property_trace,
    valid_rrules,
)

_TASK_BY_MODE = {
    "leaderboard": seed.TASK_LEADERBOARD,
    "event": seed.TASK_EVENT,
}
#: Modes that share seeded analysis tasks and reject RRULE writes (not ``project``).
_ANALYSIS_RRULE_MODES = st.sampled_from(tuple(_TASK_BY_MODE))
_SUPPLIED_RRULES = st.one_of(valid_rrules, st.text(max_size=80))


def _assert_calendar_only_rejection(response: Any) -> None:
    """Legacy ``rrule`` on TaskConfigBody is forbidden (schedule is a subresource)."""
    assert response.status_code == 422
    body = response.json()
    assert_keys(body, ["error_code", "message", "details", "correlation_id"], "ValidationError")
    assert body["error_code"] == "VALIDATION_ERROR"
    blob = f"{body.get('message')} {body.get('details')}".lower()
    assert "rrule" in blob or "extra" in blob or "forbidden" in blob
    assert isinstance(body["correlation_id"], str) and body["correlation_id"]


async def _persistence_snapshot(db: Any) -> dict[str, Any]:
    tables = await db.fetch_all(
        "SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    )
    snapshot: dict[str, Any] = {"user_version": await db.fetch_value("PRAGMA user_version")}
    for table_row in tables:
        table = str(table_row["name"])
        rows = await db.fetch_all(f'SELECT * FROM "{table}"')  # noqa: S608 - names come from sqlite_schema
        snapshot[table] = tuple(sorted((tuple(sorted(row.items())) for row in rows), key=repr))
    return snapshot


def _scheduler_snapshot(scheduler: Any) -> tuple[Any, ...]:
    jobs = tuple(
        sorted(
            (
                job.id,
                id(job),
                job.name,
                repr(job.trigger),
                tuple(job.args),
                tuple(sorted(job.kwargs.items())),
            )
            for job in scheduler._scheduler.get_jobs()
        )
    )
    return (
        scheduler._scheduler.state,
        scheduler.paused,
        scheduler.in_flight,
        scheduler.queue_size,
        jobs,
    )


async def _ensure_incomplete_state(db: Any, task_id: str) -> None:
    states = (("pending", "pending", "msg-2"), ("processing", "processing", "msg-3"))
    for suffix, status, message_id in states:
        batch_id = f"property-2-{task_id}-{suffix}"
        await db.execute(
            "INSERT OR IGNORE INTO analysis_batches "
            "(id, task_id, version, status, message_count, retry_count, created_at, updated_at) "
            "VALUES (?, ?, 1, ?, 1, 0, ?, ?)",
            (batch_id, task_id, status, seed.NOW, seed.NOW),
        )
        await db.execute(
            "INSERT OR IGNORE INTO analysis_markers "
            "(id, message_id, task_id, version, batch_id, analyzed_at) VALUES (?, ?, ?, 1, ?, ?)",
            (f"property-2-marker-{task_id}-{suffix}", message_id, task_id, batch_id, seed.NOW),
        )


@property_trace(2)
@settings(
    max_examples=MIN_PROPERTY_EXAMPLES,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
)
@given(mode=_ANALYSIS_RRULE_MODES, supplied_rrule=_SUPPLIED_RRULES)
async def test_new_analysis_rrule_writes_are_rejected_atomically(client, app, mode: str, supplied_rrule: str) -> None:
    """Feature: technical-debt-simplification, Property 2.

    Validates: Requirements 1.3
    """
    db = app.state.db
    scheduler = app.state.scheduler
    task_id = _TASK_BY_MODE[mode]
    await _ensure_incomplete_state(db, task_id)
    await scheduler.register_task(task_id)
    # Startup geocode backfill mutates analysis_events asynchronously; drain it
    # before snapshotting so rejected writes are not confused with that race.
    await backfill_stored_events(db)

    queue = app.state.broadcaster.subscribe()
    try:
        persistence_before = await _persistence_snapshot(db)
        scheduler_before = _scheduler_snapshot(scheduler)
        notifications_before = queue.qsize()
        create = await client.post(
            "/api/v1/tasks",
            json={
                "name": f"rejected {mode} create",
                "promptTemplate": "must not persist",
                "analysisMode": mode,
                "channelIds": [f"{seed.DISCORD_CHANNEL[0]}:{seed.DISCORD_CHANNEL[1]}"],
                "scheduleType": "daily",
                "scheduleValue": "08:00",
                "rrule": supplied_rrule,
            },
        )
        _assert_calendar_only_rejection(create)
        assert await _persistence_snapshot(db) == persistence_before
        assert _scheduler_snapshot(scheduler) == scheduler_before
        assert queue.qsize() == notifications_before

        persistence_before = await _persistence_snapshot(db)
        scheduler_before = _scheduler_snapshot(scheduler)
        notifications_before = queue.qsize()
        update = await client.put(
            f"/api/v1/tasks/{task_id}",
            json={
                "name": f"rejected {mode} update",
                "description": "must not persist",
                "promptTemplate": "must not persist",
                "analysisMode": mode,
                "analysisTimeRange": "7d",
                "channelIds": [f"{seed.DISCORD_CHANNEL[0]}:{seed.DISCORD_CHANNEL[1]}"],
                "scheduleType": "daily",
                "scheduleValue": "08:00",
                "rrule": supplied_rrule,
            },
        )
        _assert_calendar_only_rejection(update)
        assert await _persistence_snapshot(db) == persistence_before
        assert _scheduler_snapshot(scheduler) == scheduler_before
        assert queue.qsize() == notifications_before
    finally:
        app.state.broadcaster.unsubscribe(queue)

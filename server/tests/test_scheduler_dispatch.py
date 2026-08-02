"""Scheduler trigger, registration, and dispatch examples."""

import logging

import pytest
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from server.domain.schedule import legacy_to_trigger_rrule
from server.scheduler.manager import SchedulerManager, _QueuedTask, schedule_trigger_from_rrule
from server.sse import SseBroadcaster
from server.tests import seed
from server.tests.db_helpers import insert_legacy_analysis_task


@pytest.mark.parametrize(
    ("schedule_type", "schedule_value", "trigger_type", "expected"),
    [
        ("seconds_10", None, IntervalTrigger, 10),
        ("hourly", None, IntervalTrigger, 3600),
        ("custom_seconds", "7", IntervalTrigger, 7),
        ("daily", "09:30", CronTrigger, {"day_of_week": "*", "hour": "9", "minute": "30"}),
        ("weekly", "1:14:45", CronTrigger, {"day_of_week": "mon", "hour": "14", "minute": "45"}),
    ],
)
def test_supported_schedule_examples(schedule_type, schedule_value, trigger_type, expected):
    """Preserve concrete examples for all five interval/cron schedules.

    **Validates: Requirements 1.1, 1.2**
    """
    trigger = schedule_trigger_from_rrule(legacy_to_trigger_rrule(schedule_type, schedule_value))

    assert type(trigger) is trigger_type
    if isinstance(trigger, IntervalTrigger):
        assert trigger.interval.total_seconds() == expected
    else:
        fields = {field.name: str(field) for field in trigger.fields}
        assert {name: fields[name] for name in expected} == expected
        assert fields["second"] == "0"


async def test_unknown_schedule_and_invalid_persisted_schedules_are_isolated(app, caplog):
    """Unknown input fails clearly; bad persisted values do not block valid tasks.

    **Validates: Requirements 1.1, 1.2, 1.7**
    """
    with pytest.raises(ValueError, match="Unknown schedule_type: unsupported"):
        schedule_trigger_from_rrule(legacy_to_trigger_rrule("unsupported", None))

    db = app.state.db
    bad_schedules = (
        ("invalid-daily-schedule", "INVALID;broken=daily"),
        ("invalid-weekly-schedule", "FREQ=WEEKLY;BYDAY=XX"),
    )
    for task_id, schedule_rrule in bad_schedules:
        await insert_legacy_analysis_task(
            db,
            task_id,
            analysis_mode="leaderboard",
            schedule_rrule=schedule_rrule,
            rrule=None,
        )

    caplog.set_level(logging.ERROR, logger="server.scheduler.manager")
    manager = SchedulerManager(db, analysis_engine=None, broadcaster=SseBroadcaster())
    await manager._register_all_active_tasks()

    registered_ids = {job.id for job in manager._scheduler.get_jobs()}
    assert {seed.TASK_LEADERBOARD, seed.TASK_EVENT, seed.TASK_EVENT_TIMED} <= registered_ids
    assert registered_ids.isdisjoint({task_id for task_id, _ in bad_schedules})
    assert "Invalid schedule for task invalid-daily-schedule" in caplog.text
    assert "Invalid schedule for task invalid-weekly-schedule" in caplog.text


async def test_re_registration_replaces_the_existing_task_job(app):
    """Re-registering a task replaces, rather than duplicates, its timer.

    **Validates: Requirements 1.1, 1.2, 1.6**
    """
    manager = SchedulerManager(app.state.db, analysis_engine=None, broadcaster=SseBroadcaster())
    await manager.register_task(seed.TASK_LEADERBOARD)
    original = manager._scheduler.get_job(seed.TASK_LEADERBOARD)
    assert original is not None
    assert isinstance(original.trigger, IntervalTrigger)
    assert original.trigger.interval.total_seconds() == 10

    await app.state.db.execute(
        "UPDATE analysis_tasks SET schedule_rrule = 'FREQ=HOURLY' WHERE id = ?",
        (seed.TASK_LEADERBOARD,),
    )
    await manager.register_task(seed.TASK_LEADERBOARD)

    jobs = [job for job in manager._scheduler.get_jobs() if job.id == seed.TASK_LEADERBOARD]
    assert len(jobs) == 1
    assert jobs[0] is not original
    assert isinstance(jobs[0].trigger, IntervalTrigger)
    assert jobs[0].trigger.interval.total_seconds() == 3600


@pytest.mark.parametrize(
    ("analysis_mode", "is_active"),
    [("recurring", 1), ("leaderboard", 0)],
)
async def test_re_registration_removes_jobs_for_recurring_or_inactive(app, analysis_mode, is_active):
    """Recurring and inactive tasks retain no scheduler job, including stale jobs.

    **Validates: Requirements 1.6**
    """
    manager = SchedulerManager(app.state.db, analysis_engine=None, broadcaster=SseBroadcaster())
    await manager.register_task(seed.TASK_LEADERBOARD)
    assert manager._scheduler.get_job(seed.TASK_LEADERBOARD) is not None

    await app.state.db.execute(
        "UPDATE analysis_tasks SET analysis_mode = ?, is_active = ? WHERE id = ?",
        (analysis_mode, is_active, seed.TASK_LEADERBOARD),
    )
    await manager.register_task(seed.TASK_LEADERBOARD)

    assert manager._scheduler.get_job(seed.TASK_LEADERBOARD) is None


async def test_repeated_timer_fires_queue_task_once(app):
    manager = SchedulerManager(
        db=app.state.db,
        analysis_engine=None,
        broadcaster=SseBroadcaster(),
    )
    manager._available = 0

    await manager._on_timer_fire("task-1")
    await manager._on_timer_fire("task-1")

    assert manager.queue_size == 1


async def test_timer_queues_when_at_capacity(app):
    manager = SchedulerManager(
        db=app.state.db,
        analysis_engine=None,
        broadcaster=SseBroadcaster(),
    )
    manager._available = 0
    spawned: list[str] = []
    manager._spawn_batch = lambda task_id: spawned.append(task_id)  # type: ignore[method-assign]

    await manager._on_timer_fire("task-queued")

    assert spawned == []
    assert manager.queue_size == 1


async def test_wait_queue_drains_fifo(app):
    manager = SchedulerManager(
        db=app.state.db,
        analysis_engine=None,
        broadcaster=SseBroadcaster(),
    )
    manager._wait_queue.append(_QueuedTask(task_id="first", enqueued_at=0.0))
    manager._wait_queue.append(_QueuedTask(task_id="second", enqueued_at=0.0))
    manager._available = 2
    spawned: list[str] = []
    manager._spawn_batch = lambda task_id: spawned.append(task_id)  # type: ignore[method-assign]

    while manager._wait_queue and manager._available > 0:
        if manager._try_acquire():
            queued = manager._wait_queue.popleft()
            manager._spawn_batch(queued.task_id)

    assert spawned == ["first", "second"]
    assert manager.queue_size == 0

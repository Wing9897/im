"""Property test for inert legacy RRULE data on analysis tasks."""

from datetime import datetime, timezone
from typing import Any

from apscheduler.triggers.interval import IntervalTrigger
from hypothesis import HealthCheck, example, given, settings
from hypothesis import strategies as st

from server.scheduler.manager import SchedulerManager
from server.sse import SseBroadcaster
from server.tests.db_helpers import insert_legacy_analysis_task
from server.tests.property_strategies import (
    MIN_PROPERTY_EXAMPLES,
    analysis_task_modes,
    property_trace,
    supported_schedules,
    valid_rrules,
)

_invalid_rrules = st.text(alphabet=st.characters(min_codepoint=33, max_codepoint=126), min_size=1, max_size=40).map(
    lambda payload: f"INVALID:{payload}"
)
_legacy_rrules = st.one_of(valid_rrules, _invalid_rrules, st.just(""), st.none())
_REFERENCE_FIRE_TIME = datetime(2030, 1, 1, tzinfo=timezone.utc)


def _normalized_trigger_configuration(trigger: Any) -> tuple[Any, ...]:
    if isinstance(trigger, IntervalTrigger):
        return (trigger.interval.total_seconds(), str(trigger.timezone), trigger.end_date, trigger.jitter)
    return (
        tuple((field.name, str(field)) for field in trigger.fields),
        str(trigger.timezone),
        trigger.start_date,
        trigger.end_date,
        trigger.jitter,
    )


async def _registered_job_observation(db: Any, task_id: str) -> tuple[int, Any, Any, Any]:
    manager = SchedulerManager(db, analysis_engine=None, broadcaster=SseBroadcaster())
    await manager.register_task(task_id)
    jobs = manager._scheduler.get_jobs()
    job = jobs[0] if jobs else None
    if job is None:
        return len(jobs), None, None, None
    trigger = job.trigger
    next_fire = trigger.get_next_fire_time(_REFERENCE_FIRE_TIME, _REFERENCE_FIRE_TIME)
    return len(jobs), type(trigger), _normalized_trigger_configuration(trigger), next_fire


# Feature: technical-debt-simplification, Property 5
@property_trace(5)
@settings(
    max_examples=MIN_PROPERTY_EXAMPLES,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
)
@example(mode="leaderboard", schedule=("daily", "00:00"), legacy_rrule="FREQ=DAILY")
@example(mode="event", schedule=("hourly", None), legacy_rrule="not-an-rrule")
@example(mode="leaderboard", schedule=("weekly", "6:23:59"), legacy_rrule=None)
@given(mode=analysis_task_modes, schedule=supported_schedules, legacy_rrule=_legacy_rrules)
async def test_legacy_rrule_does_not_interfere_with_scheduler(app, mode, schedule, legacy_rrule):
    """Feature: technical-debt-simplification, Property 5.

    **Validates: Requirements 1.7**
    """
    db = app.state.db
    legacy_id, control_id = "property-5-legacy", "property-5-null-control"
    await db.execute("DELETE FROM analysis_tasks WHERE id IN (?, ?)", (legacy_id, control_id))
    schedule_type, schedule_value = schedule
    common = {
        "analysis_mode": mode,
        "schedule_type": schedule_type,
        "schedule_value": schedule_value,
    }
    await insert_legacy_analysis_task(db, legacy_id, rrule=legacy_rrule, **common)
    await insert_legacy_analysis_task(db, control_id, rrule=None, **common)

    legacy = await _registered_job_observation(db, legacy_id)
    control = await _registered_job_observation(db, control_id)

    assert legacy == control
    assert legacy[0] == 1

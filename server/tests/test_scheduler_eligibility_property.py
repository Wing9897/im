"""Property test for scheduler eligibility and registration idempotence."""

from hypothesis import HealthCheck, given, settings
from hypothesis import strategies as st

from server.domain.analysis_modes import SCHEDULABLE_ANALYSIS_MODES
from server.domain.schedule import preset_to_trigger_rrule
from server.scheduler.manager import SchedulerManager
from server.sse import SseBroadcaster
from server.tests.property_strategies import (
    MIN_PROPERTY_EXAMPLES,
    property_trace,
    supported_schedules,
    task_modes,
)
from server.tests.seed import ensure_default_llm_profile
from server.util import utc_now_iso

_task_ids = st.text(
    alphabet=st.characters(min_codepoint=ord("a"), max_codepoint=ord("z")),
    min_size=1,
    max_size=24,
).map(lambda suffix: f"property-4-{suffix}")


@property_trace(4)
@settings(
    max_examples=MIN_PROPERTY_EXAMPLES,
    deadline=None,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
)
@given(mode=task_modes, active=st.booleans(), task_id=_task_ids, schedule=supported_schedules)
async def test_scheduler_eligibility_and_registration_idempotence(app, mode, active, task_id, schedule):
    schedule_type, schedule_value = schedule
    schedule_rrule = preset_to_trigger_rrule(schedule_type, schedule_value)
    now = utc_now_iso()
    await app.state.db.execute("DELETE FROM analysis_tasks WHERE id = ?", (task_id,))
    profile_id = await ensure_default_llm_profile(app.state.db)
    await app.state.db.execute(
        "INSERT INTO analysis_tasks (id, name, prompt_template, analysis_mode, "
        "analysis_time_range, version, is_active, schedule_rrule, llm_profile_id, "
        "created_at, updated_at) VALUES (?, ?, ?, ?, 'all', 1, ?, ?, ?, ?, ?)",
        (task_id, "Property 4 task", "Analyze", mode, int(active), schedule_rrule, profile_id, now, now),
    )

    manager = SchedulerManager(app.state.db, analysis_engine=None, broadcaster=SseBroadcaster())
    for _ in range(3):
        await manager.register_task(task_id)

    jobs = manager._scheduler.get_jobs()
    if active and mode in SCHEDULABLE_ANALYSIS_MODES:
        assert len(jobs) == 1
        assert jobs[0].id == task_id
        assert manager._scheduler.get_job(task_id) is jobs[0]
    else:
        assert jobs == []
        assert manager._scheduler.get_job(task_id) is None

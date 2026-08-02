"""Property tests for the supported analysis schedule contract."""

from typing import Any

from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from hypothesis import example, given, settings
from hypothesis import strategies as st

from server.domain.schedule import legacy_to_trigger_rrule
from server.scheduler.manager import schedule_trigger_from_rrule
from server.tests.property_strategies import MIN_PROPERTY_EXAMPLES, property_trace, supported_schedules, task_modes

_WEEKDAYS = ("sun", "mon", "tue", "wed", "thu", "fri", "sat")


def _normalized_trigger(trigger: IntervalTrigger | CronTrigger) -> tuple[Any, ...]:
    if isinstance(trigger, IntervalTrigger):
        return ("interval", trigger.interval.total_seconds(), trigger.jitter)
    return (
        "cron",
        tuple((field.name, str(field)) for field in trigger.fields),
        str(trigger.timezone),
        trigger.jitter,
    )


def _trigger_from_task(task: dict[str, Any]) -> IntervalTrigger | CronTrigger:
    return schedule_trigger_from_rrule(
        legacy_to_trigger_rrule(task["schedule_type"], task["schedule_value"])
    )


_unrelated_metadata = st.fixed_dictionaries(
    {
        "id": st.text(min_size=1, max_size=24),
        "analysis_mode": task_modes,
        "rrule": st.one_of(st.none(), st.text(max_size=40)),
        "event_title": st.one_of(st.none(), st.text(max_size=40)),
        "event_description": st.one_of(st.none(), st.text(max_size=80)),
        "is_active": st.booleans(),
    }
)


# Feature: technical-debt-simplification, Property 1
@property_trace(1)
@settings(max_examples=MIN_PROPERTY_EXAMPLES)
@example(
    schedule=("seconds_10", None),
    metadata={
        "id": "a",
        "analysis_mode": "leaderboard",
        "rrule": None,
        "event_title": None,
        "event_description": None,
        "is_active": False,
    },
)
@example(
    schedule=("hourly", None),
    metadata={
        "id": "a",
        "analysis_mode": "recurring",
        "rrule": "",
        "event_title": "x",
        "event_description": "y",
        "is_active": True,
    },
)
@example(
    schedule=("custom_seconds", "1"),
    metadata={
        "id": "a",
        "analysis_mode": "event",
        "rrule": "FREQ=DAILY",
        "event_title": None,
        "event_description": None,
        "is_active": False,
    },
)
@example(
    schedule=("custom_seconds", "86400"),
    metadata={
        "id": "a",
        "analysis_mode": "event",
        "rrule": None,
        "event_title": "x",
        "event_description": None,
        "is_active": True,
    },
)
@example(
    schedule=("daily", "00:00"),
    metadata={
        "id": "a",
        "analysis_mode": "leaderboard",
        "rrule": None,
        "event_title": None,
        "event_description": None,
        "is_active": False,
    },
)
@example(
    schedule=("daily", "23:59"),
    metadata={
        "id": "a",
        "analysis_mode": "recurring",
        "rrule": "invalid",
        "event_title": "x",
        "event_description": "y",
        "is_active": True,
    },
)
@example(
    schedule=("weekly", "0:00:00"),
    metadata={
        "id": "a",
        "analysis_mode": "event",
        "rrule": None,
        "event_title": None,
        "event_description": None,
        "is_active": False,
    },
)
@example(
    schedule=("weekly", "6:23:59"),
    metadata={
        "id": "a",
        "analysis_mode": "event",
        "rrule": "FREQ=WEEKLY",
        "event_title": "x",
        "event_description": "y",
        "is_active": True,
    },
)
@given(schedule=supported_schedules, metadata=_unrelated_metadata)
def test_supported_schedule_totality_and_determinism(schedule, metadata):
    """Feature: technical-debt-simplification, Property 1.

    **Validates: Requirements 1.1, 1.2**
    """
    schedule_type, schedule_value = schedule
    first_task = {**metadata, "schedule_type": schedule_type, "schedule_value": schedule_value}
    varied_task = {
        **metadata,
        "id": f"{metadata['id']}-varied",
        "analysis_mode": "recurring" if metadata["analysis_mode"] != "recurring" else "leaderboard",
        "rrule": f"{metadata['rrule'] or ''}-varied",
        "event_title": f"{metadata['event_title'] or ''}-varied",
        "event_description": f"{metadata['event_description'] or ''}-varied",
        "is_active": not metadata["is_active"],
        "schedule_type": schedule_type,
        "schedule_value": schedule_value,
    }

    first = _trigger_from_task(first_task)
    varied = _trigger_from_task(varied_task)
    assert type(first) is type(varied)
    assert _normalized_trigger(first) == _normalized_trigger(varied)

    if schedule_type in {"seconds_10", "hourly", "custom_seconds"}:
        if schedule_type == "seconds_10":
            expected_seconds = 10
        elif schedule_type == "hourly":
            expected_seconds = 3600
        else:
            assert schedule_value is not None
            expected_seconds = int(schedule_value)
        assert type(first) is IntervalTrigger
        assert first.interval.total_seconds() == expected_seconds
        return

    assert type(first) is CronTrigger
    fields = {field.name: str(field) for field in first.fields}
    if schedule_type == "daily":
        hour, minute = schedule_value.split(":")
        assert fields["day_of_week"] == "*"
    else:
        day, hour, minute = schedule_value.split(":")
        assert fields["day_of_week"] == _WEEKDAYS[int(day)]
    assert fields["hour"] == str(int(hour))
    assert fields["minute"] == str(int(minute))
    assert fields["second"] == "0"

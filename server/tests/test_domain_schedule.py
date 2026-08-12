"""Unit tests for unified trigger / calendar schedule helpers."""

import pytest
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from server.domain.schedule import (
    may_calendar_expand_series,
    may_register_trigger,
    preset_to_trigger_rrule,
    resolve_trigger_rrule,
    trigger_from_rrule,
    trigger_rrule_to_preset,
)


@pytest.mark.parametrize(
    ("preset", "value", "rrule"),
    [
        ("seconds_10", None, "FREQ=SECONDLY;INTERVAL=10"),
        ("hourly", None, "FREQ=HOURLY"),
        ("custom_seconds", "7", "FREQ=SECONDLY;INTERVAL=7"),
        ("daily", "09:30", "FREQ=DAILY;BYHOUR=9;BYMINUTE=30"),
        ("weekly", "1:14:45", "FREQ=WEEKLY;BYDAY=MO;BYHOUR=14;BYMINUTE=45"),
    ],
)
def test_legacy_preset_round_trip(preset, value, rrule):
    assert preset_to_trigger_rrule(preset, value) == rrule
    assert trigger_rrule_to_preset(rrule) == (preset, value)


def test_purpose_gates():
    assert may_register_trigger("intel_event")
    assert may_register_trigger("leaderboard")
    assert may_register_trigger("agent")
    assert not may_register_trigger("recurring")
    assert may_calendar_expand_series({"is_active": 1, "rrule": "FREQ=DAILY"})
    assert not may_calendar_expand_series({"is_active": 0, "rrule": "FREQ=DAILY"})


def test_resolve_recurring_shell_is_null():
    assert resolve_trigger_rrule(analysis_mode="recurring", schedule_rrule="FREQ=SECONDLY;INTERVAL=10") is None


def test_trigger_from_rrule_builds_apscheduler_triggers():
    assert isinstance(trigger_from_rrule("FREQ=SECONDLY;INTERVAL=10"), IntervalTrigger)
    assert isinstance(trigger_from_rrule("FREQ=HOURLY"), IntervalTrigger)
    assert isinstance(trigger_from_rrule("FREQ=DAILY;BYHOUR=9;BYMINUTE=30"), CronTrigger)

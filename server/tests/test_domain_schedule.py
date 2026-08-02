"""Unit tests for unified trigger / calendar schedule helpers."""

from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
import pytest

from server.domain.schedule import (
    legacy_to_trigger_rrule,
    may_calendar_expand,
    may_register_trigger,
    resolve_trigger_rrule,
    trigger_from_rrule,
    trigger_rrule_to_legacy,
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
    assert legacy_to_trigger_rrule(preset, value) == rrule
    assert trigger_rrule_to_legacy(rrule) == (preset, value)


def test_purpose_gates():
    assert may_register_trigger("event")
    assert may_register_trigger("leaderboard")
    assert may_register_trigger("project")
    assert not may_register_trigger("recurring")
    assert may_calendar_expand("recurring")
    assert not may_calendar_expand("event")
    assert not may_calendar_expand("leaderboard")
    assert not may_calendar_expand("project")


def test_resolve_recurring_shell_is_null():
    assert resolve_trigger_rrule(analysis_mode="recurring", schedule_type="seconds_10") is None


def test_trigger_from_rrule_builds_apscheduler_triggers():
    assert isinstance(trigger_from_rrule("FREQ=SECONDLY;INTERVAL=10"), IntervalTrigger)
    assert isinstance(trigger_from_rrule("FREQ=HOURLY"), IntervalTrigger)
    assert isinstance(trigger_from_rrule("FREQ=DAILY;BYHOUR=9;BYMINUTE=30"), CronTrigger)

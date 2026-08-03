"""Unit checks for shared property-based testing infrastructure."""

from datetime import timezone

import pytest
from hypothesis import find, settings

from server.calendar.rrule import validate_rrule
from server.domain.analysis_modes import ALL_ANALYSIS_MODES
from server.domain.schedule import preset_to_trigger_rrule
from server.scheduler.manager import schedule_trigger_from_rrule
from server.tests.property_strategies import (
    MIN_PROPERTY_EXAMPLES,
    property_trace,
    supported_schedules,
    task_modes,
    utc_windows,
    valid_rrules,
)


@pytest.mark.parametrize("schedule_type", ("seconds_10", "hourly", "daily", "weekly", "custom_seconds"))
def test_supported_schedule_strategy_reaches_every_schedule_type(schedule_type):
    generated_type, generated_value = find(supported_schedules, lambda value: value[0] == schedule_type)

    assert generated_type == schedule_type
    assert schedule_trigger_from_rrule(preset_to_trigger_rrule(generated_type, generated_value)) is not None


@pytest.mark.parametrize("mode", ALL_ANALYSIS_MODES)
def test_task_mode_strategy_reaches_every_supported_mode(mode):
    assert find(task_modes, lambda value: value == mode) == mode


def test_rrule_strategy_generates_validator_accepted_rules():
    validate_rrule(find(valid_rrules, lambda value: value.startswith("FREQ=")))


def test_utc_window_strategy_generates_ordered_aware_windows():
    start, end = find(utc_windows, lambda value: value[0] == value[1])

    assert start.tzinfo is timezone.utc
    assert end.tzinfo is timezone.utc
    assert start <= end


def test_property_profile_and_trace_marker_are_standardized():
    @property_trace(3)
    def generated_test_placeholder():
        pass

    trace_marks = [mark for mark in generated_test_placeholder.pytestmark if mark.name == "traceability"]
    assert settings.default is not None
    assert settings.default.max_examples >= MIN_PROPERTY_EXAMPLES
    assert trace_marks[0].args == ("Feature: technical-debt-simplification, Property 3",)

"""Reusable Hypothesis strategies for scheduling-contract property tests."""

from datetime import datetime, timedelta, timezone
from typing import TypeAlias

import pytest
from hypothesis import strategies as st
from hypothesis.strategies import SearchStrategy

from server.domain.analysis_modes import ALL_ANALYSIS_MODES

MIN_PROPERTY_EXAMPLES = 100
PROPERTY_FEATURE = "property-invariants"
SupportedSchedule: TypeAlias = tuple[str, str | None]
UtcWindow: TypeAlias = tuple[datetime, datetime]

supported_schedules: SearchStrategy[SupportedSchedule] = st.one_of(
    st.just(("seconds_10", None)),
    st.just(("hourly", None)),
    st.builds(lambda seconds: ("custom_seconds", str(seconds)), st.integers(min_value=1, max_value=86_400)),
    st.builds(
        lambda hour, minute: ("daily", f"{hour:02d}:{minute:02d}"),
        st.integers(min_value=0, max_value=23),
        st.integers(min_value=0, max_value=59),
    ),
    st.builds(
        lambda day, hour, minute: ("weekly", f"{day}:{hour:02d}:{minute:02d}"),
        st.integers(min_value=0, max_value=6),
        st.integers(min_value=0, max_value=23),
        st.integers(min_value=0, max_value=59),
    ),
)

task_modes = st.sampled_from(tuple(ALL_ANALYSIS_MODES))

analysis_task_modes = st.sampled_from(("leaderboard", "event", "project"))

_WEEKDAYS = ("MO", "TU", "WE", "TH", "FR", "SA", "SU")
_rrule_bodies = st.one_of(
    st.builds(lambda interval: f"FREQ=DAILY;INTERVAL={interval}", st.integers(min_value=1, max_value=999)),
    st.builds(
        lambda days, count: f"FREQ=WEEKLY;BYDAY={','.join(days)};COUNT={count}",
        st.lists(st.sampled_from(_WEEKDAYS), min_size=1, max_size=7, unique=True),
        st.integers(min_value=1, max_value=9999),
    ),
    st.builds(
        lambda day: f"FREQ=MONTHLY;BYMONTHDAY={day}",
        st.one_of(st.integers(min_value=-31, max_value=-1), st.integers(min_value=1, max_value=31)),
    ),
    st.builds(
        lambda month, day: f"FREQ=YEARLY;BYMONTH={month};BYMONTHDAY={day}",
        st.integers(min_value=1, max_value=12),
        st.integers(min_value=1, max_value=28),
    ),
)
valid_rrules = _rrule_bodies


@st.composite
def _utc_windows(draw: st.DrawFn) -> UtcWindow:
    start = draw(
        st.datetimes(
            min_value=datetime(2000, 1, 1),
            max_value=datetime(2098, 12, 31, 23, 59, 59),
            timezones=st.just(timezone.utc),
        )
    )
    duration = draw(st.timedeltas(min_value=timedelta(0), max_value=timedelta(days=366)))
    return start, start + duration


utc_windows: SearchStrategy[UtcWindow] = _utc_windows()


def property_trace(property_number: int):
    """Return the standard pytest traceability marker for a numbered property."""
    if property_number < 1:
        raise ValueError("property_number must be positive")
    return pytest.mark.traceability(f"Feature: {PROPERTY_FEATURE}, Property {property_number}")

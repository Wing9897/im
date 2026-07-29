"""Unit tests for day-grained RRULE validation."""

from __future__ import annotations

import pytest

from server.calendar.rrule import RruleValidationError, validate_rrule


@pytest.mark.parametrize(
    "rule",
    (
        "FREQ=DAILY",
        "FREQ=WEEKLY;BYDAY=WE",
        "FREQ=MONTHLY;BYMONTHDAY=1",
        "FREQ=YEARLY;BYMONTH=7;BYMONTHDAY=27",
        "FREQ=DAILY;INTERVAL=2",
    ),
)
def test_validate_rrule_accepts_day_grained_freqs(rule: str) -> None:
    validate_rrule(rule)


def test_validate_rrule_rejects_rrule_prefix() -> None:
    with pytest.raises(RruleValidationError) as exc_info:
        validate_rrule("RRULE:FREQ=DAILY;INTERVAL=2")
    assert exc_info.value.code == "rrule_prefix"


@pytest.mark.parametrize(
    "freq",
    ("SECONDLY", "MINUTELY", "HOURLY", "BOGUS"),
)
def test_validate_rrule_rejects_subday_and_unknown_freqs(freq: str) -> None:
    with pytest.raises(RruleValidationError) as exc_info:
        validate_rrule(f"FREQ={freq}")
    assert exc_info.value.code == "unsupported_freq"
    assert freq in str(exc_info.value)

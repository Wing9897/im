"""Property-based regression coverage for calendar occurrence expansion."""

from __future__ import annotations

import re
from collections import Counter
from datetime import datetime, time, timedelta, timezone, tzinfo
from typing import Any, Mapping, Sequence

import pytest
from dateutil import rrule as reference_rrule
from hypothesis import given, settings
from hypothesis import strategies as st

from server.calendar import rrule as calendar_module
from server.calendar.occurrence_span import roll_end_if_overnight
from server.calendar.rrule import (
    MAX_OCCURRENCES,
    expand_calendar_occurrences,
    expand_task_occurrences,
    validate_rrule,
)
from server.tests.property_strategies import MIN_PROPERTY_EXAMPLES, property_trace, utc_windows, valid_rrules

_REFERENCE_ANCHOR_DATE = "20000101"
_UNTIL_Z_RE = re.compile(r"(UNTIL=[0-9T]+)Z", re.IGNORECASE)
_TIME_RE = re.compile(r"(\d{1,2}):(\d{2})")
CALENDAR_OCCURRENCE_KEYS = frozenset(
    {
        "id",
        "taskId",
        "taskName",
        "title",
        "startTime",
        "endTime",
        "isAllDay",
        "location",
        "description",
        "rrule",
    }
)


def _recurring_task(
    task_id: str,
    rule: str | None,
    hour: int = 0,
    minute: int = 0,
    *,
    all_day: bool = False,
    end_hour: int | None = None,
    end_minute: int | None = None,
    is_active: int = 1,
    location: str | None = None,
    description: str | None = None,
    iso_time: bool = False,
) -> dict[str, Any]:
    start_value = f"{hour:02d}:{minute:02d}"
    if iso_time:
        # Absolute ISO whose local clock face equals hour:minute on the host TZ.
        local_tz = calendar_module._system_tzinfo()
        local_dt = datetime(2024, 6, 15, hour, minute, tzinfo=local_tz)
        start_value = local_dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return {
        "id": task_id,
        "name": f"Recurring {task_id}",
        "analysis_mode": "recurring",
        "is_active": is_active,
        "rrule": rule,
        "event_is_all_day": all_day,
        "event_start_time": start_value,
        "event_end_time": f"{(end_hour if end_hour is not None else hour):02d}:"
        f"{(end_minute if end_minute is not None else minute):02d}",
        "event_location": location,
        "event_description": description,
    }


def _reference_time_of_day(value: Any, *, local_tz: tzinfo | None = None) -> time | None:
    """Parse generated calendar times without using production helpers."""
    zone = local_tz or calendar_module._system_tzinfo()
    if isinstance(value, str):
        text = value.strip()
        if text:
            normalized = text[:-1] + "+00:00" if text.endswith("Z") else text
            try:
                parsed = datetime.fromisoformat(normalized)
            except ValueError:
                parsed = None
            if parsed is not None:
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=timezone.utc)
                local = parsed.astimezone(zone)
                return time(local.hour, local.minute)
            match = _TIME_RE.fullmatch(text)
            if match:
                hour, minute = int(match.group(1)), int(match.group(2))
                if hour < 24 and minute < 60:
                    return time(hour, minute)
    return None


def _reference_iso_z(value: datetime) -> str:
    return value.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _full_reference_task_sequence(
    task: Mapping[str, Any], range_start: datetime, range_end: datetime
) -> list[dict[str, Any]]:
    """Independent full-materialization oracle (system-local HH:MM → UTC wire)."""
    rule = str(task.get("rrule") or "").strip()
    if not rule or rule.upper().startswith("RRULE:"):
        return []

    local_tz = calendar_module._system_tzinfo()
    is_all_day = bool(task.get("event_is_all_day"))
    start_tod = (
        time(0, 0)
        if is_all_day
        else (_reference_time_of_day(task.get("event_start_time"), local_tz=local_tz) or time(0, 0))
    )
    naive_rule = _UNTIL_Z_RE.sub(r"\1", rule)
    try:
        recurrence = reference_rrule.rrulestr(
            f"DTSTART:{_REFERENCE_ANCHOR_DATE}T{start_tod.hour:02d}{start_tod.minute:02d}00\nRRULE:{naive_rule}"
        )
        range_start_utc = range_start.astimezone(timezone.utc)
        range_end_utc = range_end.astimezone(timezone.utc)
        range_start_local = range_start.astimezone(local_tz)
        range_end_local = range_end.astimezone(local_tz)
        candidates = recurrence.between(
            range_start_local.replace(tzinfo=None) - timedelta(seconds=1),
            range_end_local.replace(tzinfo=None) + timedelta(seconds=1),
            inc=False,
        )
    except (ValueError, TypeError, OverflowError):
        return []

    task_id = str(task.get("id") or "")
    task_name = str(task.get("name") or "")
    end_tod = _reference_time_of_day(task.get("event_end_time"), local_tz=local_tz) if not is_all_day else None
    result: list[dict[str, Any]] = []
    for candidate in candidates:
        date_part = candidate.date()
        if is_all_day:
            start_dt = datetime.combine(date_part, time(0, 0), tzinfo=local_tz).astimezone(timezone.utc)
            end_dt = datetime.combine(date_part, time(23, 59, 59), tzinfo=local_tz).astimezone(timezone.utc)
        else:
            start_dt = datetime.combine(date_part, start_tod, tzinfo=local_tz).astimezone(timezone.utc)
            if end_tod is None:
                end_dt = start_dt
            else:
                start_local = datetime.combine(date_part, start_tod, tzinfo=local_tz)
                end_local = roll_end_if_overnight(
                    start_local,
                    datetime.combine(date_part, end_tod, tzinfo=local_tz),
                )
                end_dt = end_local.astimezone(timezone.utc)
        if start_dt < range_start_utc or start_dt > range_end_utc:
            continue
        result.append(
            {
                "id": f"{task_id}:{start_dt.strftime('%Y%m%dT%H%M%SZ')}",
                "taskId": task_id,
                "taskName": task_name,
                "title": task_name,
                "startTime": _reference_iso_z(start_dt),
                "endTime": _reference_iso_z(end_dt),
                "isAllDay": is_all_day,
                "location": task.get("event_location") or None,
                "description": task.get("event_description") or None,
                "rrule": rule,
            }
        )
    return result


def _reference_calendar_occurrences(
    tasks: Sequence[Mapping[str, Any]], range_start: datetime, range_end: datetime
) -> list[dict[str, Any]]:
    """Apply the shared cap by input order, then the public final ordering."""
    result: list[dict[str, Any]] = []
    for task in tasks:
        if not bool(task.get("is_active", 1)):
            continue
        remaining = MAX_OCCURRENCES - len(result)
        if remaining <= 0:
            break
        result.extend(_full_reference_task_sequence(task, range_start, range_end)[:remaining])
    return sorted(result, key=lambda item: (item["startTime"], item["taskId"]))


@st.composite
def _calendar_expansion_cases(draw: st.DrawFn):
    count = draw(st.integers(min_value=1, max_value=5))
    rules = draw(st.lists(valid_rrules, min_size=count, max_size=count))
    times = draw(
        st.lists(
            st.tuples(st.integers(min_value=0, max_value=23), st.integers(min_value=0, max_value=59), st.booleans()),
            min_size=count,
            max_size=count,
        )
    )
    tasks = [
        _recurring_task(f"task-{count - index:02d}", rule, hour, minute, all_day=all_day)
        for index, (rule, (hour, minute, all_day)) in enumerate(zip(rules, times, strict=True))
    ]
    return tasks, draw(utc_windows)


@property_trace(3)
@settings(max_examples=MIN_PROPERTY_EXAMPLES, deadline=None)
@given(
    case=_calendar_expansion_cases(),
    interval=st.integers(min_value=1, max_value=30),
    occurrence_index=st.integers(min_value=0, max_value=500),
    boundary_span=st.integers(min_value=0, max_value=30),
    boundary_time=st.tuples(st.integers(min_value=0, max_value=23), st.integers(min_value=0, max_value=59)),
)
def test_property_3_calendar_expansion_is_bounded_ordered_and_range_safe(
    case, interval, occurrence_index, boundary_span, boundary_time
):
    tasks, (range_start, range_end) = case
    for task in tasks:
        validate_rrule(task["rrule"])
        assert task["analysis_mode"] == "recurring" and task["is_active"] == 1

    occurrences = expand_calendar_occurrences(tasks, range_start, range_end)
    starts = [datetime.fromisoformat(item["startTime"].replace("Z", "+00:00")) for item in occurrences]
    assert all(range_start <= start <= range_end for start in starts)
    assert occurrences == sorted(occurrences, key=lambda item: (item["startTime"], item["taskId"]))
    assert len(occurrences) <= MAX_OCCURRENCES == 1000

    hour, minute = boundary_time
    boundary_rule = f"FREQ=DAILY;INTERVAL={interval}"
    validate_rrule(boundary_rule)
    local_tz = calendar_module._system_tzinfo()
    first_local = datetime(2000, 1, 1, hour, minute, tzinfo=local_tz) + timedelta(days=interval * occurrence_index)
    last_local = first_local + timedelta(days=interval * boundary_span)
    first = first_local.astimezone(timezone.utc)
    last = last_local.astimezone(timezone.utc)
    boundary_occurrences = expand_calendar_occurrences(
        [_recurring_task("boundary", boundary_rule, hour, minute)], first_local, last_local
    )
    assert boundary_occurrences[0]["startTime"] == first.strftime("%Y-%m-%dT%H:%M:%SZ")
    assert boundary_occurrences[-1]["startTime"] == last.strftime("%Y-%m-%dT%H:%M:%SZ")

    cap_tasks = [_recurring_task(task_id, "FREQ=DAILY;INTERVAL=1") for task_id in ("cap-c", "cap-a", "cap-b")]
    local_tz = calendar_module._system_tzinfo()
    cap_start = datetime(2000, 1, 1, tzinfo=local_tz)
    capped = expand_calendar_occurrences(cap_tasks, cap_start, cap_start + timedelta(days=366))
    assert len(capped) == MAX_OCCURRENCES
    assert {item["taskId"] for item in capped} == {"cap-a", "cap-b", "cap-c"}
    assert capped == sorted(capped, key=lambda item: (item["startTime"], item["taskId"]))


def test_occurrence_id_is_stable_across_overlapping_query_windows():
    local_tz = calendar_module._system_tzinfo()
    task = _recurring_task("stable-series", "FREQ=DAILY", 9, 30)
    shared_start = datetime(2026, 7, 15, 9, 30, tzinfo=local_tz).astimezone(timezone.utc)

    wider = expand_task_occurrences(
        task,
        datetime(2026, 7, 1, tzinfo=local_tz),
        datetime(2026, 7, 31, 23, 59, tzinfo=local_tz),
        MAX_OCCURRENCES,
    )
    narrower = expand_task_occurrences(
        task,
        datetime(2026, 7, 10, tzinfo=local_tz),
        datetime(2026, 7, 20, 23, 59, tzinfo=local_tz),
        MAX_OCCURRENCES,
    )

    expected_id = f"stable-series:{shared_start.strftime('%Y%m%dT%H%M%SZ')}"
    assert next(item["id"] for item in wider if item["startTime"] == _reference_iso_z(shared_start)) == expected_id
    assert next(item["id"] for item in narrower if item["startTime"] == _reference_iso_z(shared_start)) == expected_id


@st.composite
def _legacy_preservation_cases(draw: st.DrawFn):
    interval = draw(st.integers(min_value=1, max_value=10))
    first_index = draw(st.integers(min_value=1, max_value=40))
    span = draw(st.integers(min_value=0, max_value=20))
    hour = draw(st.integers(min_value=0, max_value=23))
    minute = draw(st.integers(min_value=0, max_value=59))
    all_day = draw(st.booleans())
    end_before_start = draw(st.booleans())
    end_hour = (hour - 1) % 24 if end_before_start else hour
    end_minute = minute
    until_form = draw(st.sampled_from(("none", "utc", "naive")))
    iso_time = draw(st.booleans())
    location = draw(st.sampled_from((None, "", "Room 7")))
    description = draw(st.sampled_from((None, "", "Observed baseline")))

    effective_hour, effective_minute = (0, 0) if all_day else (hour, minute)
    local_tz = calendar_module._system_tzinfo()
    anchor = datetime(2000, 1, 1, effective_hour, effective_minute, tzinfo=local_tz)
    first = anchor + timedelta(days=interval * first_index)
    last = first + timedelta(days=interval * span)
    rule_body = f"FREQ=DAILY;INTERVAL={interval}"
    if until_form != "none":
        until = last.strftime("%Y%m%dT%H%M%S")
        rule_body += f";UNTIL={until}{'Z' if until_form == 'utc' else ''}"
    task = _recurring_task(
        "valid-boundary",
        rule_body,
        hour,
        minute,
        all_day=all_day,
        end_hour=end_hour,
        end_minute=end_minute,
        location=location,
        description=description,
        iso_time=iso_time,
    )
    complete_count = span + 1
    budget = draw(st.integers(min_value=complete_count, max_value=MAX_OCCURRENCES))

    skipped = [
        _recurring_task("invalid", "FREQ=NOTREAL", hour, minute),
        _recurring_task("inactive", "FREQ=DAILY;COUNT=1000", hour, minute, is_active=0),
        _recurring_task("missing-rule", None, hour, minute),
        _recurring_task("no-result", "FREQ=DAILY;UNTIL=19991231T000000Z", hour, minute),
    ]
    mixed_tasks = list(draw(st.permutations((*skipped, task))))
    return task, mixed_tasks, first, last, budget, interval, complete_count


@pytest.mark.traceability("Feature: correctness-hardening-round-3, Property 5")
@settings(max_examples=100, deadline=None)
@given(case=_legacy_preservation_cases())
def test_property_5_preserves_legacy_calendar_semantics_when_sequence_fits_budget(case):
    """The unfixed observable sequence is preserved for every generated N <= B case."""
    task, mixed_tasks, range_start, range_end, budget, interval, complete_count = case
    reference = _full_reference_task_sequence(task, range_start, range_end)
    assert len(reference) == complete_count <= budget

    actual = expand_task_occurrences(task, range_start, range_end, budget)
    assert actual == reference
    assert actual[0]["startTime"] == _reference_iso_z(range_start)
    assert actual[-1]["startTime"] == _reference_iso_z(range_end)
    starts = {item["startTime"] for item in actual}
    assert _reference_iso_z(range_start - timedelta(days=interval)) not in starts
    assert _reference_iso_z(range_end + timedelta(days=interval)) not in starts
    assert all(range_start <= datetime.fromisoformat(value.replace("Z", "+00:00")) <= range_end for value in starts)
    assert all(frozenset(item) == CALENDAR_OCCURRENCE_KEYS for item in actual)

    mixed_reference = _reference_calendar_occurrences(mixed_tasks, range_start, range_end)
    mixed_actual = expand_calendar_occurrences(mixed_tasks, range_start, range_end)
    assert mixed_actual == mixed_reference == reference
    assert {item["taskId"] for item in mixed_actual} == {task["id"]}


@st.composite
def _shared_allocation_cases(draw: st.DrawFn):
    first_count = draw(st.integers(min_value=1, max_value=400))
    second_count = draw(st.integers(min_value=1, max_value=400))
    task_ids = draw(st.permutations(("task-z", "task-a", "task-m")))
    hours = draw(st.lists(st.integers(min_value=0, max_value=23), min_size=3, max_size=3))
    minutes = draw(st.lists(st.integers(min_value=0, max_value=59), min_size=3, max_size=3))
    counts = (first_count, second_count, MAX_OCCURRENCES)
    tasks = [
        _recurring_task(
            task_id,
            f"FREQ=DAILY;COUNT={count}",
            hour,
            minute,
            location=f"Location {position}",
            description=f"Description {position}",
        )
        for position, (task_id, count, hour, minute) in enumerate(zip(task_ids, counts, hours, minutes, strict=True))
    ]
    range_start = datetime(2000, 1, 1, tzinfo=calendar_module._system_tzinfo())
    range_end = range_start + timedelta(days=1200, hours=23, minutes=59, seconds=59)
    return tasks, range_start, range_end, counts


@pytest.mark.traceability("Feature: correctness-hardening-round-3, Property 6")
@settings(max_examples=100, deadline=None)
@given(case=_shared_allocation_cases())
def test_property_6_preserves_shared_allocation_final_order_and_exact_contract(case):
    """Input order owns the cap while public output remains sorted and unchanged."""
    tasks, range_start, range_end, counts = case
    expected = _reference_calendar_occurrences(tasks, range_start, range_end)
    actual = expand_calendar_occurrences(tasks, range_start, range_end)

    assert actual == expected
    assert len(actual) == MAX_OCCURRENCES
    assert actual == sorted(actual, key=lambda item: (item["startTime"], item["taskId"]))
    assert all(frozenset(item) == CALENDAR_OCCURRENCE_KEYS for item in actual)

    expected_allocations = {
        tasks[0]["id"]: counts[0],
        tasks[1]["id"]: counts[1],
        tasks[2]["id"]: MAX_OCCURRENCES - counts[0] - counts[1],
    }
    assert Counter(item["taskId"] for item in actual) == Counter(expected_allocations)


class _ObservedRecurrence:
    """Test-only proxy that counts candidates delivered to production."""

    def __init__(self, delegate: Any, observation: dict[str, int]) -> None:
        self._delegate = delegate
        self._observation = observation

    def between(self, *args: Any, **kwargs: Any) -> list[datetime]:
        candidates = self._delegate.between(*args, **kwargs)
        self._observation["candidates"] += len(candidates)
        return candidates

    def xafter(self, *args: Any, **kwargs: Any):
        for candidate in self._delegate.xafter(*args, **kwargs):
            self._observation["candidates"] += 1
            yield candidate

    def __getattr__(self, name: str) -> Any:
        return getattr(self._delegate, name)


def _observe_task_expansion(
    task: Mapping[str, Any], range_start: datetime, range_end: datetime, budget: int
) -> tuple[list[dict[str, Any]], int, int]:
    """Observe candidate delivery and serialization without production counters."""
    from server.calendar import rrule as calendar_module

    observation = {"candidates": 0, "iso_calls": 0}
    original_rrulestr = calendar_module.du_rrule.rrulestr
    original_iso_z = calendar_module._iso_z

    def observed_rrulestr(*args: Any, **kwargs: Any) -> _ObservedRecurrence:
        return _ObservedRecurrence(original_rrulestr(*args, **kwargs), observation)

    def observed_iso_z(value: datetime) -> str:
        observation["iso_calls"] += 1
        return original_iso_z(value)

    with pytest.MonkeyPatch.context() as monkeypatch:
        monkeypatch.setattr(calendar_module.du_rrule, "rrulestr", observed_rrulestr)
        monkeypatch.setattr(calendar_module, "_iso_z", observed_iso_z)
        actual = calendar_module.expand_task_occurrences(task, range_start, range_end, budget)

    assert observation["iso_calls"] % 2 == 0
    return actual, observation["candidates"], observation["iso_calls"] // 2


@st.composite
def _calendar_bug_condition_cases(draw: st.DrawFn):
    """Generate guaranteed N>B cases, including dense and widened starts."""
    mode = draw(st.sampled_from(("dense", "widened")))
    local_tz = calendar_module._system_tzinfo()
    if mode == "dense":
        budget = draw(st.integers(min_value=0, max_value=MAX_OCCURRENCES))
        excess = draw(st.integers(min_value=1, max_value=20))
        interval = draw(st.integers(min_value=1, max_value=3))
        range_start = datetime(2000, 1, 1, tzinfo=local_tz)
        range_end = range_start + timedelta(seconds=interval * (budget + excess - 1))
        task = _recurring_task("generated-dense", f"FREQ=SECONDLY;INTERVAL={interval}")
    else:
        budget = draw(st.integers(min_value=1, max_value=40))
        base = datetime(2000, 1, 1, tzinfo=local_tz)
        range_start = base + timedelta(microseconds=500_000)
        range_end = base + timedelta(days=budget + 1)
        task = _recurring_task("generated-widened", "FREQ=DAILY")
    return task, range_start, range_end, budget


@pytest.mark.traceability("Feature: correctness-hardening-round-3, Property 2")
@settings(max_examples=100, deadline=None)
@given(case=_calendar_bug_condition_cases())
def test_property_2_bounded_calendar_reference_prefix_for_generated_bug_conditions(case):
    """Every generated N>B case returns its exact bounded reference prefix."""
    task, range_start, range_end, budget = case
    reference = _full_reference_task_sequence(task, range_start, range_end)
    assert len(reference) > budget

    actual, candidate_count, materialized_count = _observe_task_expansion(task, range_start, range_end, budget)

    assert actual == reference[:budget]
    assert candidate_count <= budget + 2
    assert materialized_count == len(actual) <= budget


@pytest.mark.parametrize(
    ("budget", "range_start", "range_end", "expected_reference_count"),
    (
        (
            0,
            "local-day-point",
            None,
            1,
        ),
        (
            1,
            "local-two-days",
            None,
            2,
        ),
        (
            1,
            "local-widened",
            None,
            2,
        ),
    ),
    ids=("B=0", "B=1-N=B+1", "widened-start-N=B+1"),
)
def test_property_2_budget_and_widened_boundary_examples(
    budget: int, range_start: str, range_end: None, expected_reference_count: int
):
    """Lock the B=0, B=1, N=B+1, and widened-boundary cases."""
    local_tz = calendar_module._system_tzinfo()
    if range_start == "local-day-point":
        start = datetime(2000, 1, 1, 0, 0, tzinfo=local_tz)
        end = datetime(2000, 1, 1, 0, 0, tzinfo=local_tz)
    elif range_start == "local-two-days":
        start = datetime(2000, 1, 1, 0, 0, tzinfo=local_tz)
        end = datetime(2000, 1, 2, 0, 0, tzinfo=local_tz)
    else:
        start = datetime(2000, 1, 1, 0, 0, 0, 500_000, tzinfo=local_tz)
        end = datetime(2000, 1, 3, 0, 0, tzinfo=local_tz)

    task = _recurring_task("boundary-budget", "FREQ=DAILY")
    reference = _full_reference_task_sequence(task, start, end)
    assert len(reference) == expected_reference_count > budget

    actual, candidate_count, materialized_count = _observe_task_expansion(task, start, end, budget)

    assert actual == reference[:budget]
    assert candidate_count <= budget + 2
    assert materialized_count == len(actual) <= budget


def test_property_2_secondly_365_day_regression_is_exact_and_bounded():
    """The dense 365-day query obtains only the exact 1000-member prefix."""
    budget = MAX_OCCURRENCES
    local_tz = calendar_module._system_tzinfo()
    range_start = datetime(2000, 1, 1, tzinfo=local_tz)
    range_end = range_start + timedelta(days=365)
    task = _recurring_task("secondly-365", "FREQ=SECONDLY")
    # The first 1000 members are independent of the later end of this dense window.
    expected_prefix = _full_reference_task_sequence(task, range_start, range_start + timedelta(seconds=budget - 1))
    assert len(expected_prefix) == budget

    actual, candidate_count, materialized_count = _observe_task_expansion(task, range_start, range_end, budget)

    assert actual == expected_prefix
    assert candidate_count <= budget + 2
    assert materialized_count == budget

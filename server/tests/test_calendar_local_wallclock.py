"""Focused contracts for calendar HH:MM = system-local wall clock."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from server.calendar import rrule as calendar_module
from server.calendar.rrule import expand_task_occurrences


def test_hhmm_expands_in_system_local_timezone(monkeypatch) -> None:
    offset = timezone(timedelta(hours=8))
    monkeypatch.setattr(calendar_module, "_system_tzinfo", lambda: offset)

    task = {
        "id": "local-cal",
        "name": "本地十點",
        "analysis_mode": "recurring",
        "is_active": 1,
        "rrule": "FREQ=DAILY",
        "event_is_all_day": 0,
        "event_start_time": "10:00",
        "event_end_time": "11:00",
        "event_location": None,
        "event_description": None,
    }
    # Window in UTC that covers 2026-07-01 10:00 +08 (= 02:00Z).
    range_start = datetime(2026, 7, 1, 0, 0, tzinfo=timezone.utc)
    range_end = datetime(2026, 7, 1, 23, 59, tzinfo=timezone.utc)
    items = expand_task_occurrences(task, range_start, range_end, budget=5)
    assert len(items) == 1
    assert items[0]["startTime"] == "2026-07-01T02:00:00Z"
    assert items[0]["endTime"] == "2026-07-01T03:00:00Z"


def test_iso_event_start_uses_local_clock_face(monkeypatch) -> None:
    offset = timezone(timedelta(hours=8))
    monkeypatch.setattr(calendar_module, "_system_tzinfo", lambda: offset)

    # Absolute 02:00Z == 10:00 +08; stored ISO should yield local 10:00 expansion.
    task = {
        "id": "iso-cal",
        "name": "ISO",
        "analysis_mode": "recurring",
        "is_active": 1,
        "rrule": "FREQ=DAILY",
        "event_is_all_day": 0,
        "event_start_time": "2026-07-01T02:00:00Z",
        "event_end_time": None,
        "event_location": None,
        "event_description": None,
    }
    range_start = datetime(2026, 7, 1, 0, 0, tzinfo=timezone.utc)
    range_end = datetime(2026, 7, 1, 23, 59, tzinfo=timezone.utc)
    items = expand_task_occurrences(task, range_start, range_end, budget=5)
    assert len(items) == 1
    assert items[0]["startTime"] == "2026-07-01T02:00:00Z"


def test_overnight_hhmm_rolls_end_to_next_local_day(monkeypatch) -> None:
    """Non-import expand must keep overnight clocks (22:00→06:00), not clamp to zero."""
    offset = timezone(timedelta(hours=8))
    monkeypatch.setattr(calendar_module, "_system_tzinfo", lambda: offset)

    task = {
        "id": "overnight-cal",
        "name": "夜班",
        "analysis_mode": "recurring",
        "is_active": 1,
        "rrule": "FREQ=DAILY",
        "event_is_all_day": 0,
        # No event_start_local → synthetic-anchor expand path.
        "event_start_time": "22:00",
        "event_end_time": "06:00",
        "event_location": None,
        "event_description": None,
    }
    range_start = datetime(2026, 7, 1, 0, 0, tzinfo=timezone.utc)
    range_end = datetime(2026, 7, 1, 23, 59, tzinfo=timezone.utc)
    items = expand_task_occurrences(task, range_start, range_end, budget=5)
    assert len(items) == 1
    # 22:00 +08 = 14:00Z; 06:00 next day +08 = 22:00Z.
    assert items[0]["startTime"] == "2026-07-01T14:00:00Z"
    assert items[0]["endTime"] == "2026-07-01T22:00:00Z"


def test_overnight_imported_and_synthetic_paths_agree(monkeypatch) -> None:
    """Write-path dtend overnight + imported expand must match synthetic expand."""
    from server.calendar.occurrence_span import roll_end_if_overnight
    from server.services.recurring_schedule_values import manual_end_anchor

    offset = timezone(timedelta(hours=8))
    monkeypatch.setattr(calendar_module, "_system_tzinfo", lambda: offset)

    dtstart = "2026-07-01T22:00:00"
    dtend = manual_end_anchor(dtstart, "06:00", is_all_day=False)
    assert dtend == "2026-07-02T06:00:00"
    assert roll_end_if_overnight(
        datetime.fromisoformat(dtstart),
        datetime.fromisoformat("2026-07-01T06:00:00"),
    ) == datetime.fromisoformat(dtend)

    synthetic = {
        "id": "overnight-parity",
        "name": "夜班",
        "analysis_mode": "recurring",
        "is_active": 1,
        "rrule": "FREQ=DAILY",
        "event_is_all_day": 0,
        "event_start_time": "22:00",
        "event_end_time": "06:00",
    }
    imported = {
        **synthetic,
        "event_start_local": dtstart,
        "event_end_local": dtend,
        "event_timezone": "floating",
        "ics_source": None,
    }
    range_start = datetime(2026, 7, 1, 0, 0, tzinfo=timezone.utc)
    range_end = datetime(2026, 7, 1, 23, 59, tzinfo=timezone.utc)
    syn_items = expand_task_occurrences(synthetic, range_start, range_end, budget=5)
    imp_items = expand_task_occurrences(imported, range_start, range_end, budget=5)
    assert len(syn_items) == 1 and len(imp_items) == 1
    assert syn_items[0]["startTime"] == imp_items[0]["startTime"]
    assert syn_items[0]["endTime"] == imp_items[0]["endTime"]


def test_all_day_floating_with_until_z_expands(monkeypatch) -> None:
    """Manual all-day plans store DATE dtstart + UI UNTIL=...Z (task 「1234」 shape).

    SQL aliases dtstart → event_start_local, so expansion uses the imported path
    with a naive DATE DTSTART. dateutil rejects UTC UNTIL against naive DTSTART
    unless Z is stripped.
    """
    offset = timezone(timedelta(hours=8))
    monkeypatch.setattr(calendar_module, "_system_tzinfo", lambda: offset)

    task = {
        "id": "task-1234",
        "name": "1234",
        "analysis_mode": "recurring",
        "is_active": 1,
        "rrule": "FREQ=DAILY;UNTIL=20270819T235959Z",
        "event_is_all_day": 1,
        "event_start_time": "2026-08-01",
        "event_end_time": "2026-08-02",
        "event_start_local": "2026-08-01",
        "event_end_local": "2026-08-02",
        "event_timezone": "floating",
        "ics_source": None,
        "event_location": None,
        "event_description": None,
    }
    # August 2026 in UTC+8 (month window used by the timeline month grid).
    range_start = datetime(2026, 7, 31, 16, 0, 0, tzinfo=timezone.utc)
    range_end = datetime(2026, 8, 31, 15, 59, 59, tzinfo=timezone.utc)
    items = expand_task_occurrences(task, range_start, range_end, budget=100)
    assert len(items) >= 28
    assert items[0]["startTime"] == "2026-07-31T16:00:00Z"
    assert items[0]["isAllDay"] is True
    assert all(item["title"] == "1234" for item in items)

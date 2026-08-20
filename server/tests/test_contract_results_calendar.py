"""Contract keys: calendar items expansion via results surface."""

from __future__ import annotations

from datetime import UTC, datetime

from server.calendar import rrule as calendar_module
from server.tests import seed


async def test_calendar_occurrences(client):
    resp = await client.get(
        "/api/v1/calendar/occurrences",
        params={
            "rangeStart": "2026-07-01T00:00:00Z",
            "rangeEnd": "2026-07-31T23:59:59Z",
            "includeItems": "false",
        },
    )
    body = resp.json()
    # Weekly Monday rule → 4 Mondays in July 2026 window (6,13,20,27).
    assert len(body) == 4
    expected_keys = {
        "id",
        "seriesId",
        "taskName",
        "title",
        "startTime",
        "endTime",
        "isAllDay",
        "timezone",
        "location",
        "description",
        "rrule",
        "dismissed",
        "important",
        "isLastOccurrence",
        "source",
        "worksetId",
        "itemId",
        "itemDateKind",
        "notifyPref",
        "emoji",
    }
    for occurrence in body:
        assert set(occurrence) == expected_keys
        assert occurrence["source"] == "recurring"
    assert body[0]["startTime"] == "2026-07-06T10:00:00Z"


async def test_calendar_includes_endpoints_and_skips_invalid_or_inactive_persisted_tasks(app, client, caplog):
    """Persisted bad/inactive calendar rows stay isolated from inclusive expansion."""
    now = "2026-07-01T00:00:00+00:00"
    fixtures = (
        ("calendar-invalid-persisted", 1, "FREQ=NOTREAL"),
        ("calendar-inactive", 0, "FREQ=DAILY"),
    )
    for series_id, is_active, rrule in fixtures:
        await app.state.db.execute(
            "INSERT INTO recurring_schedules "
            "(id, name, workset_id, is_active, rrule, dtstart, dtend, timezone, created_at, updated_at) "
            "VALUES (?, ?, '__general__', ?, ?, '2000-01-01T10:00:00', "
            "'2000-01-01T11:00:00', 'floating', ?, ?)",
            (series_id, series_id, is_active, rrule, now, now),
        )

    response = await client.get(
        "/api/v1/calendar/occurrences",
        params={
            "rangeStart": "2026-07-06T10:00:00Z",
            "rangeEnd": "2026-07-13T10:00:00Z",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert [(item["seriesId"], item["startTime"]) for item in body] == [
        (seed.TASK_CALENDAR, "2026-07-06T10:00:00Z"),
        (seed.TASK_CALENDAR, "2026-07-13T10:00:00Z"),
    ]
    assert "Skipping recurring task calendar-invalid-persisted" in caplog.text
    assert all(item["seriesId"] != "calendar-inactive" for item in body)


async def test_calendar_persisted_mixture_preserves_allocation_contract_and_final_order(app, client, caplog):
    """The persisted API path preserves skip, budget, boundary, and wire contracts."""
    # Task-form ``HH:MM`` clocks are system-local wall time, so the requested
    # window and the expected wire instants are derived from the host timezone.
    local_tz = calendar_module._system_tzinfo()

    def utc_at(day: int, hour: int) -> datetime:
        local = datetime(2000, 1, day, hour, 0, tzinfo=local_tz)
        return local.astimezone(UTC)

    def wire(moment: datetime) -> str:
        return moment.strftime("%Y-%m-%dT%H:%M:%SZ")

    def occurrence_id(task_id: str, moment: datetime) -> str:
        return f"{task_id}:{moment.strftime('%Y%m%dT%H%M%SZ')}"

    day1_start, day1_end = utc_at(1, 10), utc_at(1, 11)
    day2_start, day2_end = utc_at(2, 10), utc_at(2, 11)

    db = app.state.db
    now = "2026-07-01T00:00:00+00:00"
    fixtures = (
        (
            "z-calendar-boundary",
            "Boundary owner",
            1,
            "FREQ=DAILY",
            "10:00",
            "11:00",
            "Room Z",
            "Inclusive endpoints",
        ),
        ("calendar-invalid", "Invalid", 1, "FREQ=NOTREAL", "10:00", "11:00", None, None),
        ("calendar-inactive", "Inactive", 0, "FREQ=SECONDLY", "10:00", "11:00", None, None),
        ("a-calendar-dense", "Dense follower", 1, "FREQ=SECONDLY", "10:00", None, None, None),
        ("calendar-after-budget", "After budget", 1, "FREQ=DAILY", "10:00", "11:00", None, None),
    )
    for series_id, name, is_active, rrule, start_time, end_time, location, description in fixtures:
        await db.execute(
            "INSERT INTO recurring_schedules "
            "(id, name, workset_id, is_active, rrule, dtstart, dtend, location, description, "
            "timezone, created_at, updated_at) "
            "VALUES (?, ?, '__general__', ?, ?, ?, ?, ?, ?, 'floating', ?, ?)",
            (
                series_id,
                name,
                is_active,
                rrule,
                f"2000-01-01T{start_time}:00",
                f"2000-01-01T{end_time}:00" if end_time else None,
                location,
                description,
                now,
                now,
            ),
        )

    response = await client.get(
        "/api/v1/calendar/occurrences",
        params={
            "rangeStart": wire(day1_start),
            "rangeEnd": wire(day2_start),
            "includeItems": "false",
        },
    )

    assert response.status_code == 200
    body = response.json()
    occurrence_keys = {
        "id",
        "seriesId",
        "taskName",
        "title",
        "startTime",
        "endTime",
        "isAllDay",
        "timezone",
        "location",
        "description",
        "rrule",
        "dismissed",
        "important",
        "isLastOccurrence",
        "source",
        "worksetId",
        "itemId",
        "itemDateKind",
        "notifyPref",
        "emoji",
    }
    assert len(body) == 1000
    assert all(set(item) == occurrence_keys for item in body)
    assert [(item["startTime"], item["seriesId"]) for item in body] == sorted(
        (item["startTime"], item["seriesId"]) for item in body
    )

    by_task: dict[str, list[dict]] = {}
    for item in body:
        by_task.setdefault(item["seriesId"], []).append(item)
    assert set(by_task) == {"z-calendar-boundary", "a-calendar-dense"}
    assert len(by_task["z-calendar-boundary"]) == 2
    assert len(by_task["a-calendar-dense"]) == 998
    assert [item["startTime"] for item in by_task["z-calendar-boundary"]] == [
        wire(day1_start),
        wire(day2_start),
    ]

    assert body[0] == {
        "id": occurrence_id("a-calendar-dense", day1_start),
        "seriesId": "a-calendar-dense",
        "taskName": "Dense follower",
        "title": "Dense follower",
        "startTime": wire(day1_start),
        "endTime": wire(day1_start),
        "isAllDay": False,
        "timezone": None,
        "location": None,
        "description": None,
        "rrule": "FREQ=SECONDLY",
        "dismissed": False,
        "important": False,
        "isLastOccurrence": False,
        "source": "recurring",
        "worksetId": "__general__",
        "itemId": None,
        "itemDateKind": None,
        "notifyPref": "off",
        "emoji": None,
    }
    assert by_task["z-calendar-boundary"][0] == {
        "id": occurrence_id("z-calendar-boundary", day1_start),
        "seriesId": "z-calendar-boundary",
        "taskName": "Boundary owner",
        "title": "Boundary owner",
        "startTime": wire(day1_start),
        "endTime": wire(day1_end),
        "isAllDay": False,
        "timezone": None,
        "location": "Room Z",
        "description": "Inclusive endpoints",
        "rrule": "FREQ=DAILY",
        "dismissed": False,
        "important": False,
        "isLastOccurrence": False,
        "source": "recurring",
        "worksetId": "__general__",
        "itemId": None,
        "itemDateKind": None,
        "notifyPref": "off",
        "emoji": None,
    }
    assert body[-1] == {
        **by_task["z-calendar-boundary"][0],
        "id": occurrence_id("z-calendar-boundary", day2_start),
        "startTime": wire(day2_start),
        "endTime": wire(day2_end),
    }
    assert "Skipping recurring task calendar-invalid" in caplog.text

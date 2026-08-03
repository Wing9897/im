"""Contract keys: tasks RRULE / recurring schedule routes."""

from __future__ import annotations

from server.tests import seed
from server.tests.contract_tasks_helpers import assert_validation_error


async def test_non_calendar_create_rejects_legacy_rrule_fields(client, app):
    """Recurring fields are forbidden on TaskConfigBody (use /tasks/{id}/schedule)."""
    db = app.state.db
    before_count = await db.fetch_value("SELECT COUNT(*) FROM analysis_tasks")

    for name, extra_fields in (
        ("analysis rrule", {"analysisMode": "event", "rrule": "FREQ=DAILY"}),
        ("empty default-mode rrule", {"rrule": ""}),
    ):
        resp = await client.post(
            "/api/v1/tasks",
            json={
                "name": name,
                "promptTemplate": "analyse",
                "channelIds": [],
                "scheduleRrule": "FREQ=HOURLY",
                **extra_fields,
            },
        )
        assert resp.status_code == 422, name

    assert await db.fetch_value("SELECT COUNT(*) FROM analysis_tasks") == before_count


async def test_calendar_invalid_rrule_retains_detail_shape_without_persistence(client, app):
    db = app.state.db
    created = await client.post(
        "/api/v1/tasks",
        json={
            "name": "schedule-validation-shell",
            "promptTemplate": "",
            "analysisMode": "recurring",
            "channelIds": [],
        },
    )
    assert created.status_code == 201
    task_id = created.json()["id"]
    before_schedules = await db.fetch_value("SELECT COUNT(*) FROM recurring_schedules")

    for name, rrule, expected_detail in (
        ("empty calendar rrule", "", "Invalid RRULE (empty): RRULE is empty"),
        (
            "bad calendar frequency",
            "FREQ=BOGUS",
            "Invalid RRULE (unsupported_freq): Unsupported FREQ: BOGUS (allowed: DAILY, WEEKLY, MONTHLY, YEARLY)",
        ),
        (
            "sub-day calendar frequency",
            "FREQ=HOURLY",
            "Invalid RRULE (unsupported_freq): Unsupported FREQ: HOURLY (allowed: DAILY, WEEKLY, MONTHLY, YEARLY)",
        ),
        (
            "rrule prefix rejected",
            "RRULE:FREQ=DAILY",
            "RRULE must not include an 'RRULE:' prefix",
        ),
    ):
        resp = await client.put(
            f"/api/v1/tasks/{task_id}/schedule",
            json={"rrule": rrule, "eventStartTime": "09:00"},
        )
        assert_validation_error(resp, expected_detail)

    assert await db.fetch_value("SELECT COUNT(*) FROM recurring_schedules") == before_schedules


async def test_calendar_schedule_update_validates_rrule(client, app):
    db = app.state.db
    task_id = seed.TASK_CALENDAR
    before = await db.fetch_one("SELECT * FROM recurring_schedules WHERE task_id = ?", (task_id,))
    resp = await client.put(
        f"/api/v1/tasks/{task_id}/schedule",
        json={"rrule": "FREQ=BOGUS", "eventStartTime": "09:00"},
    )
    assert_validation_error(
        resp,
        "Invalid RRULE (unsupported_freq): Unsupported FREQ: BOGUS (allowed: DAILY, WEEKLY, MONTHLY, YEARLY)",
    )
    assert await db.fetch_one("SELECT * FROM recurring_schedules WHERE task_id = ?", (task_id,)) == before


async def test_atomic_recurring_create_endpoint(client, app):
    """Timeline path: POST /tasks/recurring creates task + schedule atomically."""
    before_tasks = await app.state.db.fetch_value("SELECT COUNT(*) FROM analysis_tasks")
    before_schedules = await app.state.db.fetch_value("SELECT COUNT(*) FROM recurring_schedules")

    created = await client.post(
        "/api/v1/tasks/recurring",
        json={
            "name": "Atomic standup",
            "rrule": "FREQ=WEEKLY;BYDAY=MO",
            "eventStartTime": "09:00",
            "eventEndTime": "09:30",
            "eventIsAllDay": False,
            "worksetId": "__user__",
            "description": "notes",
            "eventDescription": "notes",
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["analysisMode"] == "recurring"
    assert body["worksetId"] == "__user__"
    task_id = body["id"]

    schedule = await client.get(f"/api/v1/tasks/{task_id}/schedule")
    assert schedule.status_code == 200
    assert schedule.json()["rrule"] == "FREQ=WEEKLY;BYDAY=MO"
    assert schedule.json()["eventStartTime"] == "09:00"

    assert await app.state.db.fetch_value("SELECT COUNT(*) FROM analysis_tasks") == before_tasks + 1
    assert await app.state.db.fetch_value("SELECT COUNT(*) FROM recurring_schedules") == before_schedules + 1

    bad = await client.post(
        "/api/v1/tasks/recurring",
        json={"name": "bad", "rrule": "FREQ=BOGUS", "eventStartTime": "09:00"},
    )
    assert bad.status_code == 422
    assert await app.state.db.fetch_value("SELECT COUNT(*) FROM analysis_tasks") == before_tasks + 1


async def test_timeline_all_day_recurring_with_until_z_appears_in_calendar_items(client, app):
    """Dialog-shaped create: atomic recurring + all-day schedule with UI UNTIL=...Z."""
    created = await client.post(
        "/api/v1/tasks/recurring",
        json={
            "name": "1234",
            "rrule": "FREQ=DAILY;UNTIL=20270819T235959Z",
            "eventIsAllDay": True,
            "eventStartTime": None,
            "eventEndTime": None,
            "worksetId": "__user__",
        },
    )
    assert created.status_code == 201, created.text
    task_id = created.json()["id"]
    row = await app.state.db.fetch_one(
        "SELECT workset_id, analysis_mode FROM analysis_tasks WHERE id = ?",
        (task_id,),
    )
    assert row is not None
    assert row["analysis_mode"] == "recurring"
    assert row["workset_id"] == "__user__"

    items = await client.get(
        "/api/v1/calendar/items",
        params={
            "range_start": "2026-07-31T16:00:00Z",
            "range_end": "2026-08-31T15:59:59Z",
            "task_ids": [task_id],
        },
    )
    assert items.status_code == 200
    body = items.json()
    assert len(body) >= 28
    assert all(item["taskId"] == task_id and item["title"] == "1234" for item in body)

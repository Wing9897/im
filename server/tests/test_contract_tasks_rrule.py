"""Contract keys: task trigger RRULEs and standalone calendar series."""

from __future__ import annotations

from server.tests import seed
from server.tests.contract_tasks_helpers import assert_validation_error


async def test_non_calendar_create_rejects_legacy_rrule_fields(client, app):
    """Calendar recurrence fields are forbidden on analysis-task bodies."""
    db = app.state.db
    before_count = await db.fetch_value("SELECT COUNT(*) FROM analysis_tasks")

    for name, extra_fields in (
        ("analysis rrule", {"analysisMode": "intel_event", "rrule": "FREQ=DAILY"}),
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
        "/api/v1/calendar/recurring",
        json={
            "name": "schedule-validation-series",
            "rrule": "FREQ=DAILY",
            "eventStartTime": "09:00",
        },
    )
    assert created.status_code == 201, created.text
    series_id = created.json()["id"]
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
        resp = await client.patch(
            f"/api/v1/calendar/recurring/{series_id}",
            json={"rrule": rrule, "eventStartTime": "09:00"},
        )
        assert_validation_error(resp, expected_detail)

    assert await db.fetch_value("SELECT COUNT(*) FROM recurring_schedules") == before_schedules


async def test_post_tasks_rejects_recurring_shell(client, app):
    """Hard-cut: analysisMode=recurring is not an analysis task."""
    before = await app.state.db.fetch_value("SELECT COUNT(*) FROM analysis_tasks")
    resp = await client.post(
        "/api/v1/tasks",
        json={
            "name": "shell-blocked",
            "promptTemplate": "",
            "analysisMode": "recurring",
            "channelIds": [],
        },
    )
    assert resp.status_code == 422
    assert await app.state.db.fetch_value("SELECT COUNT(*) FROM analysis_tasks") == before


async def test_calendar_schedule_update_validates_rrule(client, app):
    db = app.state.db
    series_id = seed.SERIES_CALENDAR
    before = await db.fetch_one("SELECT * FROM recurring_schedules WHERE id = ?", (series_id,))
    resp = await client.patch(
        f"/api/v1/calendar/recurring/{series_id}",
        json={"rrule": "FREQ=BOGUS", "eventStartTime": "09:00"},
    )
    assert_validation_error(
        resp,
        "Invalid RRULE (unsupported_freq): Unsupported FREQ: BOGUS (allowed: DAILY, WEEKLY, MONTHLY, YEARLY)",
    )
    assert await db.fetch_one("SELECT * FROM recurring_schedules WHERE id = ?", (series_id,)) == before


async def test_atomic_recurring_create_endpoint(client, app):
    """Calendar create persists one standalone series and no analysis-task shell."""
    before_tasks = await app.state.db.fetch_value("SELECT COUNT(*) FROM analysis_tasks")
    before_schedules = await app.state.db.fetch_value("SELECT COUNT(*) FROM recurring_schedules")

    created = await client.post(
        "/api/v1/calendar/recurring",
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
    assert "analysisMode" not in body
    assert body["worksetId"] == "__user__"
    series_id = body["id"]

    schedule = await client.get(f"/api/v1/calendar/recurring/{series_id}")
    assert schedule.status_code == 200
    assert schedule.json()["rrule"] == "FREQ=WEEKLY;BYDAY=MO"
    assert schedule.json()["eventStartTime"] == "09:00"

    assert await app.state.db.fetch_value("SELECT COUNT(*) FROM analysis_tasks") == before_tasks
    assert await app.state.db.fetch_value("SELECT COUNT(*) FROM recurring_schedules") == before_schedules + 1

    bad = await client.post(
        "/api/v1/calendar/recurring",
        json={"name": "bad", "rrule": "FREQ=BOGUS", "eventStartTime": "09:00"},
    )
    assert bad.status_code == 422
    assert await app.state.db.fetch_value("SELECT COUNT(*) FROM analysis_tasks") == before_tasks

    assert (await client.post("/api/v1/tasks/recurring", json={})).status_code == 404
    assert (await client.get(f"/api/v1/tasks/{series_id}/schedule")).status_code == 404


async def test_atomic_recurring_create_persists_item_id(client, app):
    """Recurring calendar may belong to an inventory item (not event→sub-event)."""
    item = await client.post(
        "/api/v1/items",
        json={"title": "Passport", "worksetId": "__user__"},
    )
    assert item.status_code == 201, item.text
    item_id = item.json()["id"]

    created = await client.post(
        "/api/v1/calendar/recurring",
        json={
            "name": "Renewal check",
            "rrule": "FREQ=WEEKLY;BYDAY=MO",
            "eventStartTime": "10:00",
            "eventIsAllDay": False,
            "worksetId": "__user__",
            "itemId": item_id,
        },
    )
    assert created.status_code == 201, created.text
    series_id = created.json()["id"]

    row = await app.state.db.fetch_one(
        "SELECT item_id FROM recurring_schedules WHERE id = ?",
        (series_id,),
    )
    assert row is not None
    assert row["item_id"] == item_id

    listed = await client.get(
        "/api/v1/calendar/recurring",
        params={"itemId": item_id},
    )
    assert listed.status_code == 200, listed.text
    listed_body = listed.json()["items"]
    assert len(listed_body) == 1
    assert listed_body[0]["id"] == series_id
    assert listed_body[0]["itemId"] == item_id
    assert "analysisMode" not in listed_body[0]

    unbound = await client.get("/api/v1/calendar/recurring", params={"itemId": ""})
    assert unbound.status_code == 200
    assert all(row.get("itemId") in (None, "") for row in unbound.json()["items"])

    # Series anchors at create-time wall clock; query a window after dtstart.
    cal = await client.get(
        "/api/v1/calendar/items",
        params={
            "rangeStart": "2026-08-01T00:00:00Z",
            "rangeEnd": "2026-09-30T23:59:59Z",
            "seriesId": series_id,
            "includeItems": "false",
        },
    )
    assert cal.status_code == 200, cal.text
    body = cal.json()
    assert len(body) >= 1
    assert all(occ.get("itemId") == item_id for occ in body)

    bad = await client.post(
        "/api/v1/calendar/recurring",
        json={
            "name": "orphan",
            "rrule": "FREQ=DAILY",
            "eventStartTime": "09:00",
            "itemId": "missing-item",
        },
    )
    assert bad.status_code == 422


async def test_timeline_all_day_recurring_with_until_z_appears_in_calendar_items(client, app):
    """Dialog-shaped create: atomic recurring + all-day schedule with UI UNTIL=...Z."""
    created = await client.post(
        "/api/v1/calendar/recurring",
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
    series_id = created.json()["id"]
    row = await app.state.db.fetch_one(
        "SELECT workset_id FROM recurring_schedules WHERE id = ?",
        (series_id,),
    )
    assert row is not None
    assert row["workset_id"] == "__user__"

    items = await client.get(
        "/api/v1/calendar/items",
        params={
            "rangeStart": "2026-07-31T16:00:00Z",
            "rangeEnd": "2026-08-31T15:59:59Z",
            "seriesIds": [series_id],
        },
    )
    assert items.status_code == 200
    body = items.json()
    # Series DTSTART is "today" (manual_anchor); August window length therefore
    # depends on the wall clock — require a non-empty expand, not a fixed day count.
    assert len(body) >= 1
    assert all(item["seriesId"] == series_id and item["title"] == "1234" for item in body)
    assert all(item["isAllDay"] is True and item["source"] == "recurring" for item in body)

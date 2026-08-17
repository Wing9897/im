"""API + service tests for timeline soft-dismiss markers."""

from __future__ import annotations

import json

from server.calendar.timeline_dismissals import dismiss_timeline_event, restore_timeline_event
from server.calendar.user_events_read import list_user_events
from server.calendar.user_events_write import create_user_event
from server.queries.calendar_queries import fetch_user_event


async def test_dismiss_restore_publishes_resource_modified(client, app) -> None:
    broadcaster = app.state.broadcaster
    queue = broadcaster.subscribe()
    try:
        created = await client.put(
            "/api/v1/calendar/dismissals",
            json={"source": "item_remind", "eventId": "item-occ-1"},
        )
        assert created.status_code == 200
        restored = await client.delete(
            "/api/v1/calendar/dismissals",
            params={"source": "item_remind", "eventId": "item-occ-1"},
        )
        assert restored.status_code == 204
        events = [queue.get_nowait() for _ in range(2)]
    finally:
        broadcaster.unsubscribe(queue)

    payloads = [json.loads(event["data"])["payload"] for event in events]
    assert payloads == [
        {"resourceType": "item_remind", "resourceId": "item-occ-1", "action": "dismissed"},
        {"resourceType": "item_remind", "resourceId": "item-occ-1", "action": "restored"},
    ]


async def test_dismiss_restore_roundtrip(client) -> None:
    created = await client.put(
        "/api/v1/calendar/dismissals",
        json={"source": "analysis", "eventId": "evt-analysis-1"},
    )
    assert created.status_code == 200
    body = created.json()
    assert body["source"] == "analysis"
    assert body["eventId"] == "evt-analysis-1"
    assert isinstance(body["dismissedAt"], str) and body["dismissedAt"]

    listed = await client.get("/api/v1/calendar/dismissals", params={"source": "analysis"})
    assert listed.status_code == 200
    assert any(item["eventId"] == "evt-analysis-1" for item in listed.json())

    again = await client.put(
        "/api/v1/calendar/dismissals",
        json={"source": "analysis", "eventId": "evt-analysis-1"},
    )
    assert again.status_code == 200

    restored = await client.delete(
        "/api/v1/calendar/dismissals",
        params={"source": "analysis", "eventId": "evt-analysis-1"},
    )
    assert restored.status_code == 204

    missing = await client.delete(
        "/api/v1/calendar/dismissals",
        params={"source": "analysis", "eventId": "evt-analysis-1"},
    )
    assert missing.status_code == 404


async def test_restore_rejects_snake_case_query_alias(client) -> None:
    created = await client.put(
        "/api/v1/calendar/dismissals",
        json={"source": "analysis", "eventId": "evt-alias-1"},
    )
    assert created.status_code == 200

    restored = await client.delete(
        "/api/v1/calendar/dismissals",
        params={"source": "analysis", "event_id": "evt-alias-1"},
    )
    assert restored.status_code == 422

    restored = await client.delete(
        "/api/v1/calendar/dismissals",
        params={"source": "analysis", "eventId": "evt-alias-1"},
    )
    assert restored.status_code == 204


async def test_dismiss_rejects_invalid_source(client) -> None:
    response = await client.put(
        "/api/v1/calendar/dismissals",
        json={"source": "rrule", "eventId": "x"},
    )
    assert response.status_code == 422


async def test_user_event_rest_delete_is_hard_delete(client, app) -> None:
    from server.calendar.query import get_event, query_window

    created = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "Hard delete me",
            "startTime": "2026-07-23T09:00:00Z",
        },
    )
    assert created.status_code == 201
    event_id = created.json()["id"]

    await client.put(
        "/api/v1/calendar/dismissals",
        json={"source": "user", "eventId": event_id},
    )
    await client.put(
        "/api/v1/calendar/importance",
        json={"source": "user", "eventId": event_id},
    )

    deleted = await client.delete(f"/api/v1/calendar/user-events/{event_id}")
    assert deleted.status_code == 204

    assert await fetch_user_event(app.state.db, event_id) is None
    assert await get_event(app.state.db, event_id=event_id) is None
    listed = await client.get("/api/v1/calendar/user-events")
    assert all(item["id"] != event_id for item in listed.json()["items"])
    window = await query_window(
        app.state.db,
        start="2026-07-23T00:00:00Z",
        end="2026-07-23T23:59:59Z",
    )
    assert all(item["id"] != event_id for item in window["items"])
    leftover = await app.state.db.fetch_one(
        "SELECT 1 FROM timeline_dismissals WHERE source = 'user' AND event_id = ?",
        (event_id,),
    )
    assert leftover is None
    leftover_imp = await app.state.db.fetch_one(
        "SELECT 1 FROM timeline_importance WHERE source = 'user' AND event_id = ?",
        (event_id,),
    )
    assert leftover_imp is None

    missing = await client.delete(f"/api/v1/calendar/user-events/{event_id}")
    assert missing.status_code == 404


async def test_user_event_dismissals_do_not_delete_row(client, app) -> None:
    created = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "Dismiss only",
            "startTime": "2026-07-23T09:00:00Z",
        },
    )
    assert created.status_code == 201
    event_id = created.json()["id"]
    assert created.json()["dismissed"] is False

    dismissed = await client.put(
        "/api/v1/calendar/dismissals",
        json={"source": "user", "eventId": event_id},
    )
    assert dismissed.status_code == 200

    row = await fetch_user_event(app.state.db, event_id)
    assert row is not None

    listed = await client.get("/api/v1/calendar/user-events")
    match = next(item for item in listed.json()["items"] if item["id"] == event_id)
    assert match["dismissed"] is True

    restored = await client.delete(
        "/api/v1/calendar/dismissals",
        params={"source": "user", "eventId": event_id},
    )
    assert restored.status_code == 204
    listed_again = await client.get("/api/v1/calendar/user-events")
    match_again = next(item for item in listed_again.json()["items"] if item["id"] == event_id)
    assert match_again["dismissed"] is False


async def test_user_event_delete_rejects_recurring_occurrence_id(client) -> None:
    created = await client.post(
        "/api/v1/calendar/recurring",
        json={"name": "Daily", "rrule": "FREQ=DAILY", "eventStartTime": "09:00"},
    )
    assert created.status_code == 201
    series_id = created.json()["id"]
    occ_id = f"{series_id}:20260723T010000Z"
    response = await client.delete(f"/api/v1/calendar/user-events/{occ_id}")
    assert response.status_code == 404
    still = await client.get(f"/api/v1/calendar/recurring/{series_id}")
    assert still.status_code == 200


async def test_rest_delete_recurring_series_removes_occurrences(client, app) -> None:
    from datetime import UTC, datetime, timedelta

    from server.calendar.query import query_window

    created = await client.post(
        "/api/v1/calendar/recurring",
        json={"name": "刪除循環", "rrule": "FREQ=DAILY", "eventStartTime": "09:00"},
    )
    assert created.status_code == 201
    series_id = created.json()["id"]
    now = datetime.now(UTC)
    window = await query_window(
        app.state.db,
        start=(now - timedelta(days=1)).isoformat().replace("+00:00", "Z"),
        end=(now + timedelta(days=7)).isoformat().replace("+00:00", "Z"),
    )
    occs = [item for item in window["items"] if item.get("seriesId") == series_id]
    assert occs

    deleted = await client.delete(f"/api/v1/calendar/recurring/{series_id}")
    assert deleted.status_code == 204
    missing = await client.get(f"/api/v1/calendar/recurring/{series_id}")
    assert missing.status_code == 404
    row = await app.state.db.fetch_one(
        "SELECT id FROM recurring_schedules WHERE id = ?",
        (series_id,),
    )
    assert row is None
    after = await query_window(
        app.state.db,
        start=(now - timedelta(days=1)).isoformat().replace("+00:00", "Z"),
        end=(now + timedelta(days=7)).isoformat().replace("+00:00", "Z"),
    )
    assert all(item.get("seriesId") != series_id for item in after["items"])
    again = await client.delete(f"/api/v1/calendar/recurring/{series_id}")
    assert again.status_code == 404


async def test_rrule_occurrence_id_can_be_dismissed_independently(app) -> None:
    db = app.state.db
    occ_a = "task-cal:20260723T100000Z"
    occ_b = "task-cal:20260724T100000Z"
    await dismiss_timeline_event(db, source="recurring", event_id=occ_a)
    await dismiss_timeline_event(db, source="recurring", event_id=occ_b)
    await restore_timeline_event(db, source="recurring", event_id=occ_a)

    items = await list_user_events(db)  # smoke: service still works
    assert isinstance(items, list)

    listed = await db.fetch_all("SELECT event_id FROM timeline_dismissals WHERE source = 'recurring' ORDER BY event_id")
    assert [row["event_id"] for row in listed] == [occ_b]


async def test_create_user_event_service_sets_dismissed_false(app) -> None:
    item = await create_user_event(
        app.state.db,
        title="Fresh",
        start_time="2026-07-23T12:00:00Z",
        origin="manual",
    )
    assert item["dismissed"] is False

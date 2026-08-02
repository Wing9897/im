"""API + service tests for timeline soft-dismiss markers."""

from __future__ import annotations

import json

from server.calendar.timeline_dismissals import dismiss_timeline_event, restore_timeline_event
from server.calendar.user_events import create_user_event, get_user_event_row, list_user_events


async def test_dismiss_restore_publishes_resource_modified(client, app) -> None:
    broadcaster = app.state.broadcaster
    queue = broadcaster.subscribe()
    try:
        created = await client.put(
            "/api/v1/calendar/dismissals",
            json={"source": "item", "eventId": "item-occ-1"},
        )
        assert created.status_code == 200
        restored = await client.delete(
            "/api/v1/calendar/dismissals",
            params={"source": "item", "eventId": "item-occ-1"},
        )
        assert restored.status_code == 204
        events = [queue.get_nowait() for _ in range(2)]
    finally:
        broadcaster.unsubscribe(queue)

    payloads = [json.loads(event["data"])["payload"] for event in events]
    assert payloads == [
        {"resourceType": "item", "resourceId": "item-occ-1", "action": "dismissed"},
        {"resourceType": "item", "resourceId": "item-occ-1", "action": "restored"},
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


async def test_user_event_delete_is_soft_dismiss(client, app) -> None:
    created = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "Soft delete me",
            "startTime": "2026-07-23T09:00:00Z",
        },
    )
    assert created.status_code == 201
    event_id = created.json()["id"]
    assert created.json()["dismissed"] is False

    deleted = await client.delete(f"/api/v1/calendar/user-events/{event_id}")
    assert deleted.status_code == 204

    row = await get_user_event_row(app.state.db, event_id)
    assert row is not None

    listed = await client.get("/api/v1/calendar/user-events")
    match = next(item for item in listed.json() if item["id"] == event_id)
    assert match["dismissed"] is True

    restored = await client.delete(
        "/api/v1/calendar/dismissals",
        params={"source": "user", "eventId": event_id},
    )
    assert restored.status_code == 204
    listed_again = await client.get("/api/v1/calendar/user-events")
    match_again = next(item for item in listed_again.json() if item["id"] == event_id)
    assert match_again["dismissed"] is False


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

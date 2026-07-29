"""Contract keys: user-events routes."""

from __future__ import annotations

from server.tests.contract_helpers import assert_keys
from server.user_events import create_user_event

USER_EVENT_KEYS = [
    "id",
    "title",
    "body",
    "startTime",
    "endTime",
    "location",
    "origin",
    "taskId",
    "source",
    "dismissed",
    "createdAt",
    "updatedAt",
]


async def test_user_events_list_contract(client):
    created = await client.post(
        "/api/v1/user-events",
        json={
            "title": "Contract event",
            "startTime": "2026-07-21T09:00:00Z",
            "endTime": "2026-07-21T10:00:00Z",
            "body": "notes",
            "location": "Taipei",
        },
    )
    assert created.status_code == 201
    assert_keys(created.json(), USER_EVENT_KEYS, "UserEventResponse (create)")

    listed = await client.get(
        "/api/v1/user-events",
        params={"start": "2026-07-21T00:00:00Z", "end": "2026-07-22T00:00:00Z"},
    )
    assert listed.status_code == 200
    items = listed.json()
    assert items, "expected at least one user event"
    for item in items:
        assert_keys(item, USER_EVENT_KEYS, "UserEventResponse (list)")


async def test_user_events_list_preserves_a2a_origin(client, app):
    event = await create_user_event(
        app.state.db,
        title="A2A contract event",
        start_time="2026-07-28T09:00:00Z",
        origin="a2a",
    )

    response = await client.get("/api/v1/user-events")
    listed = next(item for item in response.json() if item["id"] == event["id"])

    assert response.status_code == 200
    assert listed["origin"] == "a2a"

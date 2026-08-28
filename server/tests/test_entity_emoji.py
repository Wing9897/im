"""Entity emoji columns — items / tasks / user_events / recurring."""

from __future__ import annotations

import pytest

from server.items.normalize import EMOJI_MAX


async def test_item_emoji_roundtrip(client) -> None:
    created = await client.post(
        "/api/v1/items",
        json={"title": "Milk", "emoji": "📦"},
    )
    assert created.status_code == 201, created.text
    body = created.json()
    item_id = body["id"]
    assert body["emoji"] == "📦"

    listed = await client.get("/api/v1/items")
    row = next(item for item in listed.json() if item["id"] == item_id)
    assert row["emoji"] == "📦"

    fetched = await client.get(f"/api/v1/items/{item_id}")
    assert fetched.status_code == 200
    assert fetched.json()["emoji"] == "📦"

    patched = await client.patch(f"/api/v1/items/{item_id}", json={"emoji": "🥛"})
    assert patched.status_code == 200, patched.text
    assert patched.json()["emoji"] == "🥛"

    cleared = await client.patch(f"/api/v1/items/{item_id}", json={"emoji": ""})
    assert cleared.status_code == 200
    assert cleared.json()["emoji"] is None


async def test_item_emoji_rejects_invalid(client) -> None:
    too_long = "x" * (EMOJI_MAX + 1)
    bad_create = await client.post(
        "/api/v1/items",
        json={"title": "Bad emoji", "emoji": too_long},
    )
    assert bad_create.status_code == 422

    created = await client.post(
        "/api/v1/items",
        json={"title": "Valid emoji", "emoji": "📦"},
    )
    assert created.status_code == 201
    item_id = created.json()["id"]

    bad_patch = await client.patch(
        f"/api/v1/items/{item_id}",
        json={"emoji": too_long},
    )
    assert bad_patch.status_code == 422


async def test_task_emoji_create_and_patch(client) -> None:
    created = await client.post(
        "/api/v1/tasks",
        json={"name": "Emoji task", "promptTemplate": "x", "emoji": "🎯"},
    )
    assert created.status_code == 201, created.text
    body = created.json()
    task_id = body["id"]
    assert body["emoji"] == "🎯"

    listed = await client.get("/api/v1/tasks")
    row = next(item for item in listed.json() if item["id"] == task_id)
    assert row["emoji"] == "🎯"

    patched = await client.patch(f"/api/v1/tasks/{task_id}", json={"emoji": "📌"})
    assert patched.status_code == 200, patched.text
    assert patched.json()["emoji"] == "📌"
    assert patched.json()["version"] == body["version"]

    cleared = await client.patch(f"/api/v1/tasks/{task_id}", json={"emoji": ""})
    assert cleared.status_code == 200
    assert cleared.json()["emoji"] is None


async def test_user_event_emoji_roundtrip(client) -> None:
    created = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "Birthday",
            "startTime": "2026-08-19T10:00:00Z",
            "emoji": "🎂",
        },
    )
    assert created.status_code == 201, created.text
    event_id = created.json()["id"]
    assert created.json()["emoji"] == "🎂"

    patched = await client.patch(
        f"/api/v1/calendar/user-events/{event_id}",
        json={"emoji": "🎉"},
    )
    assert patched.status_code == 200
    assert patched.json()["emoji"] == "🎉"

    cleared = await client.patch(
        f"/api/v1/calendar/user-events/{event_id}",
        json={"emoji": None},
    )
    assert cleared.status_code == 200
    assert cleared.json()["emoji"] is None


async def test_recurring_series_emoji_roundtrip(client) -> None:
    created = await client.post(
        "/api/v1/calendar/recurring",
        json={
            "name": "Weekly",
            "rrule": "FREQ=WEEKLY;BYDAY=MO",
            "eventStartTime": "10:00",
            "emoji": "🔁",
        },
    )
    assert created.status_code == 201, created.text
    series_id = created.json()["id"]
    assert created.json()["emoji"] == "🔁"

    patched = await client.patch(
        f"/api/v1/calendar/recurring/{series_id}",
        json={"emoji": "📅"},
    )
    assert patched.status_code == 200
    assert patched.json()["emoji"] == "📅"


async def test_calendar_window_returns_tagged_emojis(client) -> None:
    user = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "Party",
            "startTime": "2026-08-19T12:00:00Z",
            "emoji": "🎂",
        },
    )
    assert user.status_code == 201, user.text

    window = await client.get(
        "/api/v1/calendar/window",
        params={"startTime": "2026-08-19T00:00:00Z", "endTime": "2026-08-19T23:59:59Z"},
    )
    assert window.status_code == 200, window.text
    payload = window.json()
    assert set(payload) >= {"items", "limit", "cursor", "nextCursor"}
    user_row = next(item for item in payload["items"] if item["id"] == user.json()["id"])
    assert user_row["source"] == "user"
    assert user_row["emoji"] == "🎂"

    skipped = await client.get(
        "/api/v1/calendar/window",
        params={
            "startTime": "2026-08-19T00:00:00Z",
            "endTime": "2026-08-19T23:59:59Z",
            "includeUser": "false",
        },
    )
    assert skipped.status_code == 200
    assert all(item["id"] != user.json()["id"] for item in skipped.json()["items"])


@pytest.mark.parametrize(
    "path",
    [
        "/api/v1/ui-prefs/schedule/emojis",
        "/api/v1/ui-prefs/tasks/emojis",
    ],
)
async def test_emoji_prefs_routes_are_gone(client, path: str) -> None:
    assert (await client.get(path)).status_code in (404, 405)
    assert (await client.put(path, json={"emojis": {}})).status_code in (404, 405)

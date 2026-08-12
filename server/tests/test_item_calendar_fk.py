"""``items`` FK: deleting an item nulls calendar ``item_id`` (not cascade-delete)."""

from __future__ import annotations

import pytest

from server.items.service import remove_item


@pytest.mark.asyncio
async def test_pragma_foreign_keys_is_on(app) -> None:
    enabled = await app.state.db.fetch_value("PRAGMA foreign_keys")
    assert int(enabled) == 1


@pytest.mark.asyncio
async def test_remove_item_nulls_linked_user_event_and_recurring_item_id(client, app) -> None:
    """ON DELETE SET NULL: calendar rows survive; item_id becomes NULL."""
    item = await client.post(
        "/api/v1/items",
        json={"title": "FK parent", "worksetId": "__user__"},
    )
    assert item.status_code == 201, item.text
    item_id = item.json()["id"]

    event = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "Linked event",
            "startTime": "2026-08-15T10:00:00Z",
            "itemId": item_id,
        },
    )
    assert event.status_code == 201, event.text
    event_id = event.json()["id"]

    series = await client.post(
        "/api/v1/calendar/recurring",
        json={
            "name": "Linked series",
            "rrule": "FREQ=WEEKLY;BYDAY=MO",
            "eventStartTime": "09:00",
            "eventIsAllDay": False,
            "worksetId": "__user__",
            "itemId": item_id,
        },
    )
    assert series.status_code == 201, series.text
    series_id = series.json()["id"]

    assert (
        await app.state.db.fetch_value("SELECT item_id FROM user_events WHERE id = ?", (event_id,))
    ) == item_id
    assert (
        await app.state.db.fetch_value(
            "SELECT item_id FROM recurring_schedules WHERE id = ?",
            (series_id,),
        )
    ) == item_id

    await remove_item(app.state.db, item_id)

    assert await app.state.db.fetch_one("SELECT id FROM items WHERE id = ?", (item_id,)) is None

    event_row = await app.state.db.fetch_one(
        "SELECT id, item_id FROM user_events WHERE id = ?",
        (event_id,),
    )
    assert event_row is not None
    assert event_row["id"] == event_id
    assert event_row["item_id"] is None

    series_row = await app.state.db.fetch_one(
        "SELECT id, item_id FROM recurring_schedules WHERE id = ?",
        (series_id,),
    )
    assert series_row is not None
    assert series_row["id"] == series_id
    assert series_row["item_id"] is None

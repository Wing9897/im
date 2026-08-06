"""Tests for timeline importance markers."""

from __future__ import annotations

import pytest

from server.calendar.timeline_importance import (
    IMPORTANT_EMOJI,
    attach_important_flag,
    is_timeline_event_important,
    mark_timeline_important,
    unmark_timeline_important,
)


@pytest.mark.asyncio
async def test_mark_unmark_roundtrip(app) -> None:
    db = app.state.db
    marked = await mark_timeline_important(db, source="user", event_id="evt-imp-1")
    assert marked["source"] == "user"
    assert marked["eventId"] == "evt-imp-1"
    assert marked["markedAt"]
    assert await is_timeline_event_important(db, source="user", event_id="evt-imp-1")
    assert IMPORTANT_EMOJI == "❗"

    items = [{"id": "evt-imp-1"}, {"id": "other"}]
    await attach_important_flag(db, source="user", items=items)
    assert items[0]["important"] is True
    assert items[1]["important"] is False

    assert await unmark_timeline_important(db, source="user", event_id="evt-imp-1") is True
    assert await is_timeline_event_important(db, source="user", event_id="evt-imp-1") is False


@pytest.mark.asyncio
async def test_importance_http_roundtrip(client) -> None:
    created = await client.put(
        "/api/v1/calendar/importance",
        json={"source": "item", "eventId": "item:x:expires"},
    )
    assert created.status_code == 200
    body = created.json()
    assert body["source"] == "item"
    assert body["eventId"] == "item:x:expires"

    listed = await client.get("/api/v1/calendar/importance", params={"source": "item"})
    assert listed.status_code == 200
    assert any(row["eventId"] == "item:x:expires" for row in listed.json())

    deleted = await client.delete(
        "/api/v1/calendar/importance",
        params={"source": "item", "eventId": "item:x:expires"},
    )
    assert deleted.status_code == 204

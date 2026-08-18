"""Item calendar projection: remind rows, dismissals, agent list_expiring."""

from __future__ import annotations

from datetime import UTC, date, datetime, timedelta

import pytest

from server.agent.tools_items import execute_items_tool
from server.calendar.query import query_window
from server.worksets_const import SYSTEM_WORKSET_ID


async def test_calendar_projects_remind_only_not_purchased_or_expires(client, app):
    today = date.today()
    expires = (today + timedelta(days=10)).isoformat()
    purchased = (today + timedelta(days=2)).isoformat()
    remind_before = 3
    remind_day = (today + timedelta(days=10 - remind_before)).isoformat()
    created = await client.post(
        "/api/v1/items",
        json={"title": "Milk", "status": "active"},
    )
    assert created.status_code == 201
    item_id = created.json()["id"]
    for title, day, remind in (
        ("購入", purchased, None),
        ("到期", expires, remind_before),
    ):
        body = {
            "title": title,
            "startTime": f"{day}T00:00:00Z",
            "isAllDay": True,
            "itemId": item_id,
            "kind": "purchase_effective" if title == "購入" else "expires",
        }
        if remind is not None:
            body["remindBeforeDays"] = remind
        ev = await client.post("/api/v1/calendar/user-events", json=body)
        assert ev.status_code == 201

    archived = await client.post(
        "/api/v1/items",
        json={"title": "Old", "status": "archived"},
    )
    assert archived.status_code == 201
    arch_id = archived.json()["id"]
    arch_ev = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "到期",
            "kind": "expires",
            "startTime": f"{expires}T00:00:00Z",
            "isAllDay": True,
            "itemId": arch_id,
            "remindBeforeDays": remind_before,
        },
    )
    assert arch_ev.status_code == 201

    start = datetime.now(UTC) - timedelta(days=1)
    end = datetime.now(UTC) + timedelta(days=40)
    result = await query_window(app.state.db, start=start, end=end, limit=100)
    item_rows = [row for row in result["items"] if row.get("source") == "item_remind"]
    ids = {row["id"] for row in item_rows}
    assert f"item:{item_id}:purchased" not in ids
    assert f"item:{item_id}:expires" not in ids
    assert f"item:{item_id}:remind" in ids
    assert not any(row.get("itemId") == arch_id for row in item_rows)

    remind_row = next(row for row in item_rows if row["id"] == f"item:{item_id}:remind")
    assert remind_row["startTime"] == f"{remind_day}T00:00:00"
    assert remind_row["endTime"] == f"{remind_day}T23:59:59"
    assert remind_row["timezone"] == "floating"
    assert remind_row["isAllDay"] is True
    assert remind_row["itemDateKind"] == "remind"
    assert remind_row["notifyPref"] == "off"

    # Changing remind days on the linked「到期」moves the calendar remind point.
    linked = await client.get("/api/v1/calendar/user-events", params={"itemId": item_id})
    expiry_id = next(row["id"] for row in linked.json()["items"] if row["title"] == "到期")
    patched = await client.patch(
        f"/api/v1/calendar/user-events/{expiry_id}",
        json={"remindBeforeDays": 5},
    )
    assert patched.status_code == 200
    remind_day_5 = (today + timedelta(days=10 - 5)).isoformat()
    result2 = await query_window(app.state.db, start=start, end=end, limit=100)
    remind_rows = [
        row for row in result2["items"] if row.get("source") == "item_remind" and row["id"] == f"item:{item_id}:remind"
    ]
    assert len(remind_rows) == 1
    assert remind_rows[0]["startTime"] == f"{remind_day_5}T00:00:00"

    # Unified REST calendar path includes the same projection.
    api = await client.get(
        "/api/v1/calendar/occurrences",
        params={
            "rangeStart": start.isoformat().replace("+00:00", "Z"),
            "rangeEnd": end.isoformat().replace("+00:00", "Z"),
        },
    )
    assert api.status_code == 200
    api_items = [row for row in api.json() if row.get("source") == "item_remind"]

    assert {row["id"] for row in api_items} >= {
        f"item:{item_id}:remind",
    }
    assert f"item:{item_id}:purchased" not in {row["id"] for row in api_items}
    assert f"item:{item_id}:expires" not in {row["id"] for row in api_items}
    api_remind = next(row for row in api_items if row["id"] == f"item:{item_id}:remind")
    assert api_remind["startTime"] == f"{remind_day_5}T00:00:00"
    assert api_remind["itemDateKind"] == "remind"


@pytest.mark.asyncio
async def test_item_occurrence_dismiss_source_item(client, app):
    day = (date.today() + timedelta(days=5)).isoformat()
    remind_before = 2
    created = await client.post(
        "/api/v1/items",
        json={"title": "Badge", "status": "active"},
    )
    assert created.status_code == 201
    item_id = created.json()["id"]
    linked = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "到期",
            "kind": "expires",
            "startTime": f"{day}T00:00:00Z",
            "isAllDay": True,
            "itemId": item_id,
            "remindBeforeDays": remind_before,
        },
    )
    assert linked.status_code == 201
    event_id = f"item:{item_id}:remind"

    dismissed = await client.put(
        "/api/v1/calendar/dismissals",
        json={"source": "item_remind", "eventId": event_id},
    )
    assert dismissed.status_code == 200
    assert dismissed.json()["source"] == "item_remind"

    start = datetime.now(UTC) - timedelta(days=1)
    end = datetime.now(UTC) + timedelta(days=40)
    api = await client.get(
        "/api/v1/calendar/occurrences",
        params={
            "rangeStart": start.isoformat().replace("+00:00", "Z"),
            "rangeEnd": end.isoformat().replace("+00:00", "Z"),
            "includeItems": "true",
        },
    )
    assert api.status_code == 200
    row = next(r for r in api.json() if r["id"] == event_id)
    assert row["source"] == "item_remind"
    assert row["dismissed"] is True

    restored = await client.delete(
        "/api/v1/calendar/dismissals",
        params={"source": "item_remind", "eventId": event_id},
    )
    assert restored.status_code == 204

    api2 = await client.get(
        "/api/v1/calendar/occurrences",
        params={
            "rangeStart": start.isoformat().replace("+00:00", "Z"),
            "rangeEnd": end.isoformat().replace("+00:00", "Z"),
        },
    )
    row2 = next(r for r in api2.json() if r["id"] == event_id)
    assert row2["dismissed"] is False


@pytest.mark.asyncio
async def test_agent_list_expiring_and_create(app, client):
    created = await execute_items_tool(
        app.state.db,
        "items.create",
        {
            "title": "Visa",
            "notes": "issuer Gov",
        },
    )
    assert created.get("created") is True
    assert created["item"]["worksetId"] == SYSTEM_WORKSET_ID
    item_id = created["item"]["id"]
    day = (date.today() + timedelta(days=5)).isoformat()
    linked = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "到期",
            "kind": "expires",
            "startTime": f"{day}T00:00:00Z",
            "isAllDay": True,
            "itemId": item_id,
            "remindBeforeDays": 2,
        },
    )
    assert linked.status_code == 201

    listed = await execute_items_tool(app.state.db, "items.list_expiring", {"days": 14})
    assert listed["count"] >= 1
    assert any(row["title"] == "Visa" for row in listed["items"])


@pytest.mark.asyncio
async def test_agent_list_expiring_reads_derived_linked_expires(client, app):
    """items.list_expiring derives expiry from primary linked kind=expires."""
    from server.tests.items_helpers import seed_item_row
    from server.util import new_id

    item_id = new_id()
    title = f"derived-expiring-{item_id[:8]}"
    expires = (date.today() + timedelta(days=3)).isoformat()
    await seed_item_row(app.state.db, item_id=item_id, title=title)
    linked = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "到期",
            "kind": "expires",
            "startTime": f"{expires}T00:00:00Z",
            "isAllDay": True,
            "itemId": item_id,
            "remindBeforeDays": 2,
        },
    )
    assert linked.status_code == 201

    listed = await execute_items_tool(app.state.db, "items.list_expiring", {"days": 14})
    assert any(row["title"] == title for row in listed["items"])


@pytest.mark.asyncio
async def test_delete_category_nulls_category_keeps_item(client):
    cat = await client.post(
        "/api/v1/items/categories",
        json={
            "name": "Temp",
            "defaultRemindBeforeDays": 7,
        },
    )
    assert cat.status_code == 201
    cat_id = cat.json()["id"]

    item = await client.post(
        "/api/v1/items",
        json={
            "title": "Thing",
            "categoryId": cat_id,
            "notes": "x=1 y=2",
        },
    )
    assert item.status_code == 201
    item_id = item.json()["id"]

    deleted = await client.delete(f"/api/v1/items/categories/{cat_id}")
    assert deleted.status_code == 200

    fetched = await client.get(f"/api/v1/items/{item_id}")
    assert fetched.status_code == 200
    body = fetched.json()
    assert body["categoryId"] is None
    assert body["notes"] == "x=1 y=2"
    assert "attributes" not in body

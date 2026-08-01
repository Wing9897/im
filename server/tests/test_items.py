"""Items domain: soft-template attributes, workset fallback, calendar projection, agent tools."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest

from server.agent.tools_items import execute_items_tool
from server.calendar.query import query_window
from server.worksets_const import SYSTEM_WORKSET_ID


@pytest.mark.asyncio
async def test_items_change_category_keeps_attributes(client):
    cats = await client.get("/api/v1/items/categories")
    assert cats.status_code == 200
    seed = cats.json()
    assert any(c.get("slug") == "passport_docs" for c in seed)
    passport = next(c for c in seed if c["slug"] == "passport_docs")
    food = next(c for c in seed if c["slug"] == "food")

    created = await client.post(
        "/api/v1/items",
        json={
            "title": "護照",
            "categoryId": passport["id"],
            "worksetId": SYSTEM_WORKSET_ID,
            "expiresAt": "2027-01-01",
            "attributes": {"id_number": "A123", "custom": "keep"},
        },
    )
    assert created.status_code == 201
    item = created.json()
    assert item["attributes"]["id_number"] == "A123"
    assert item["attributes"]["custom"] == "keep"
    assert item["remindBeforeDays"] == 90

    patched = await client.patch(
        f"/api/v1/items/{item['id']}",
        json={"categoryId": food["id"]},
    )
    assert patched.status_code == 200
    body = patched.json()
    assert body["categoryId"] == food["id"]
    assert body["attributes"]["id_number"] == "A123"
    assert body["attributes"]["custom"] == "keep"
    # Existing remind must not be overwritten by the new category default.
    assert body["remindBeforeDays"] == 90


@pytest.mark.asyncio
async def test_patch_category_applies_default_remind_when_empty(client):
    cats = await client.get("/api/v1/items/categories")
    assert cats.status_code == 200
    food = next(c for c in cats.json() if c["slug"] == "food")
    passport = next(c for c in cats.json() if c["slug"] == "passport_docs")

    created = await client.post(
        "/api/v1/items",
        json={
            "title": "Snack",
            "categoryId": food["id"],
            "worksetId": SYSTEM_WORKSET_ID,
            "expiresAt": "2026-12-01",
            "remindBeforeDays": None,
        },
    )
    assert created.status_code == 201
    item = created.json()
    assert item["remindBeforeDays"] == 3

    # Clear remind, then switch to passport → soft-fill 90 (FE-aligned).
    cleared = await client.patch(
        f"/api/v1/items/{item['id']}",
        json={"remindBeforeDays": None},
    )
    assert cleared.status_code == 200
    assert cleared.json()["remindBeforeDays"] is None

    patched = await client.patch(
        f"/api/v1/items/{item['id']}",
        json={"categoryId": passport["id"]},
    )
    assert patched.status_code == 200
    assert patched.json()["remindBeforeDays"] == 90
    assert patched.json()["categoryId"] == passport["id"]


def test_normalize_attributes_scalar_and_caps():
    from server.items.normalize import ItemValidationError, normalize_attributes

    assert normalize_attributes({"a": "1", "b": 2, "c": True}) == {
        "a": "1",
        "b": "2",
        "c": "true",
    }
    with pytest.raises(ItemValidationError, match="single scalars"):
        normalize_attributes({"bad": {"inner": "x"}})
    with pytest.raises(ItemValidationError, match="500"):
        normalize_attributes({"note": "x" * 501})
    with pytest.raises(ItemValidationError, match="40 keys"):
        normalize_attributes({f"k{i}": "v" for i in range(41)})


@pytest.mark.asyncio
async def test_attributes_reject_oversize_and_preserve_on_patch(client):
    oversize = await client.post(
        "/api/v1/items",
        json={
            "title": "Huge",
            "attributes": {"note": "x" * 501},
        },
    )
    assert oversize.status_code == 422

    ok = await client.post(
        "/api/v1/items",
        json={"title": "Ok", "attributes": {"note": "fine", "qty": "2"}},
    )
    assert ok.status_code == 201
    item_id = ok.json()["id"]

    # Unrelated PATCH must not amplify / rewrite attributes payload.
    patched = await client.patch(
        f"/api/v1/items/{item_id}",
        json={"title": "Ok2"},
    )
    assert patched.status_code == 200
    assert patched.json()["attributes"] == {"note": "fine", "qty": "2"}

    too_many = {f"k{i}": "v" for i in range(41)}
    reject_keys = await client.patch(
        f"/api/v1/items/{item_id}",
        json={"attributes": too_many},
    )
    assert reject_keys.status_code == 422


@pytest.mark.asyncio
async def test_workset_delete_reassigns_items(client):
    ws = await client.post("/api/v1/worksets", json={"name": "Company"})
    assert ws.status_code == 201
    workset_id = ws.json()["id"]

    created = await client.post(
        "/api/v1/items",
        json={"title": "Badge", "worksetId": workset_id, "expiresAt": "2026-12-01"},
    )
    assert created.status_code == 201
    item_id = created.json()["id"]

    deleted = await client.delete(f"/api/v1/worksets/{workset_id}")
    assert deleted.status_code == 200

    fetched = await client.get(f"/api/v1/items/{item_id}")
    assert fetched.status_code == 200
    assert fetched.json()["worksetId"] == SYSTEM_WORKSET_ID


@pytest.mark.asyncio
async def test_calendar_projects_active_item_dates_not_remind(client, app):
    today = date.today()
    expires = (today + timedelta(days=10)).isoformat()
    purchased = (today + timedelta(days=2)).isoformat()
    created = await client.post(
        "/api/v1/items",
        json={
            "title": "Milk",
            "purchasedAt": purchased,
            "expiresAt": expires,
            "remindBeforeDays": 3,
            "status": "active",
        },
    )
    assert created.status_code == 201
    item_id = created.json()["id"]

    archived = await client.post(
        "/api/v1/items",
        json={
            "title": "Old",
            "expiresAt": expires,
            "status": "archived",
        },
    )
    assert archived.status_code == 201

    start = datetime.now(timezone.utc) - timedelta(days=1)
    end = datetime.now(timezone.utc) + timedelta(days=40)
    result = await query_window(app.state.db, start=start, end=end, limit=100)
    item_rows = [row for row in result["items"] if row.get("source") == "item"]
    ids = {row["id"] for row in item_rows}
    assert f"item:{item_id}:purchased" in ids
    assert f"item:{item_id}:expires" in ids
    # remind_before_days must not invent a third point
    assert not any(row["id"].endswith(":remind") for row in item_rows)
    assert not any(row.get("itemId") == archived.json()["id"] for row in item_rows)

    purchased_row = next(row for row in item_rows if row["id"].endswith(":purchased"))
    # Floating all-day wall date — not UTC-converted …Z (East-8 day shift).
    assert purchased_row["startTime"] == f"{purchased}T00:00:00"
    assert purchased_row["endTime"] == f"{purchased}T23:59:59"
    assert purchased_row["timezone"] == "floating"
    assert purchased_row["isAllDay"] is True
    assert purchased_row["title"] == "Milk"
    assert purchased_row["itemDateKind"] == "purchased"

    # Unified REST calendar path includes the same projection.
    api = await client.get(
        "/api/v1/calendar/items",
        params={
            "range_start": start.isoformat().replace("+00:00", "Z"),
            "range_end": end.isoformat().replace("+00:00", "Z"),
        },
    )
    assert api.status_code == 200
    api_items = [row for row in api.json() if row.get("source") == "item"]
    assert {row["id"] for row in api_items} >= {
        f"item:{item_id}:purchased",
        f"item:{item_id}:expires",
    }
    api_purchased = next(row for row in api_items if row["id"].endswith(":purchased"))
    assert api_purchased["startTime"] == f"{purchased}T00:00:00"
    assert api_purchased["dismissed"] is False


@pytest.mark.asyncio
async def test_item_occurrence_dismiss_source_item(client, app):
    day = (date.today() + timedelta(days=5)).isoformat()
    created = await client.post(
        "/api/v1/items",
        json={"title": "Badge", "expiresAt": day, "status": "active"},
    )
    assert created.status_code == 201
    item_id = created.json()["id"]
    event_id = f"item:{item_id}:expires"

    dismissed = await client.put(
        "/api/v1/calendar/dismissals",
        json={"source": "item", "eventId": event_id},
    )
    assert dismissed.status_code == 200
    assert dismissed.json()["source"] == "item"

    start = datetime.now(timezone.utc) - timedelta(days=1)
    end = datetime.now(timezone.utc) + timedelta(days=40)
    api = await client.get(
        "/api/v1/calendar/items",
        params={
            "range_start": start.isoformat().replace("+00:00", "Z"),
            "range_end": end.isoformat().replace("+00:00", "Z"),
            "include_items": "true",
        },
    )
    assert api.status_code == 200
    row = next(r for r in api.json() if r["id"] == event_id)
    assert row["source"] == "item"
    assert row["dismissed"] is True

    restored = await client.delete(
        "/api/v1/calendar/dismissals",
        params={"source": "item", "eventId": event_id},
    )
    assert restored.status_code == 204

    api2 = await client.get(
        "/api/v1/calendar/items",
        params={
            "range_start": start.isoformat().replace("+00:00", "Z"),
            "range_end": end.isoformat().replace("+00:00", "Z"),
        },
    )
    row2 = next(r for r in api2.json() if r["id"] == event_id)
    assert row2["dismissed"] is False


@pytest.mark.asyncio
async def test_agent_list_expiring_and_create(app):
    created = await execute_items_tool(
        app.state.db,
        "items.create",
        {
            "title": "Visa",
            "expiresAt": (date.today() + timedelta(days=5)).isoformat(),
            "attributes": {"issuer": "Gov"},
        },
    )
    assert created.get("created") is True
    assert created["item"]["worksetId"] == SYSTEM_WORKSET_ID

    listed = await execute_items_tool(app.state.db, "items.list_expiring", {"days": 14})
    assert listed["count"] >= 1
    assert any(row["title"] == "Visa" for row in listed["items"])


@pytest.mark.asyncio
async def test_delete_category_nulls_category_keeps_attributes(client):
    cat = await client.post(
        "/api/v1/items/categories",
        json={
            "name": "Temp",
            "fieldSchema": [{"key": "x", "label": "X"}],
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
            "attributes": {"x": "1", "y": "2"},
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
    assert body["attributes"] == {"x": "1", "y": "2"}

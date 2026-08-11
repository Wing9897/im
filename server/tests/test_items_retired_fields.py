"""Items domain tests (categories, retired-field reject, worksets)."""

from __future__ import annotations

import pytest

from server.worksets_const import SYSTEM_WORKSET_ID


@pytest.mark.asyncio
async def test_items_seed_categories_and_change_category(client):
    cats = await client.get("/api/v1/items/categories")
    assert cats.status_code == 200
    seed = cats.json()
    expected_slugs = {
        "passport_docs",
        "food",
        "credit_card",
        "warranty",
        "contract",
        "household",
        "medicine",
        "subscription",
        "membership",
        "insurance",
        "vehicle",
        "other",
    }
    assert {c.get("slug") for c in seed} >= expected_slugs
    assert len(expected_slugs) == 12
    passport = next(c for c in seed if c["slug"] == "passport_docs")
    food = next(c for c in seed if c["slug"] == "food")
    assert passport.get("emoji")
    assert "fieldSchema" not in passport
    assert "attributes" not in passport

    created = await client.post(
        "/api/v1/items",
        json={
            "title": "護照",
            "categoryId": passport["id"],
            "worksetId": SYSTEM_WORKSET_ID,
            "notes": "id A123",
        },
    )
    assert created.status_code == 201
    item = created.json()
    assert "attributes" not in item
    assert item["notes"] == "id A123"
    assert item["remindBeforeDays"] is None
    assert item["expiresAt"] is None

    patched = await client.patch(
        f"/api/v1/items/{item['id']}",
        json={"categoryId": food["id"]},
    )
    assert patched.status_code == 200
    body = patched.json()
    assert body["categoryId"] == food["id"]
    assert body["notes"] == "id A123"
    assert body["remindBeforeDays"] is None


@pytest.mark.asyncio
async def test_create_and_patch_reject_retired_attribute_fields(client):
    """attributes / fieldSchema are removed — extra=forbid → 422."""
    cats = await client.get("/api/v1/items/categories")
    passport = next(c for c in cats.json() if c["slug"] == "passport_docs")

    with_attrs = await client.post(
        "/api/v1/items",
        json={
            "title": "證件一",
            "categoryId": passport["id"],
            "worksetId": SYSTEM_WORKSET_ID,
            "attributes": {"id_number": "B999"},
        },
    )
    assert with_attrs.status_code == 422

    ok = await client.post(
        "/api/v1/items",
        json={
            "title": "證件二",
            "categoryId": passport["id"],
            "worksetId": SYSTEM_WORKSET_ID,
        },
    )
    assert ok.status_code == 201
    item_id = ok.json()["id"]

    patch_attrs = await client.patch(
        f"/api/v1/items/{item_id}",
        json={"attributes": {"note": "x"}},
    )
    assert patch_attrs.status_code == 422

    cat = await client.post(
        "/api/v1/items/categories",
        json={
            "name": "TempDocs",
            "fieldSchema": [{"key": "id", "label": "ID"}],
        },
    )
    assert cat.status_code == 422


@pytest.mark.asyncio
async def test_item_create_update_reject_date_fields(client):
    """ItemCreate/Update bodies forbid purchasedAt/expiresAt/remindBeforeDays."""
    created = await client.post(
        "/api/v1/items",
        json={
            "title": "Snack",
            "worksetId": SYSTEM_WORKSET_ID,
            "expiresAt": "2026-12-01",
        },
    )
    assert created.status_code == 422

    with_purchased = await client.post(
        "/api/v1/items",
        json={
            "title": "優格",
            "purchasedAt": "2026-07-20",
            "expiresAt": "2026-08-01",
            "remindBeforeDays": 2,
        },
    )
    assert with_purchased.status_code == 422

    ok = await client.post(
        "/api/v1/items",
        json={"title": "Snack", "worksetId": SYSTEM_WORKSET_ID},
    )
    assert ok.status_code == 201
    item_id = ok.json()["id"]
    patched = await client.patch(
        f"/api/v1/items/{item_id}",
        json={"remindBeforeDays": 3},
    )
    assert patched.status_code == 422


@pytest.mark.asyncio
async def test_workset_delete_reassigns_items(client):
    ws = await client.post("/api/v1/worksets", json={"name": "Company"})
    assert ws.status_code == 201
    workset_id = ws.json()["id"]

    created = await client.post(
        "/api/v1/items",
        json={"title": "Badge", "worksetId": workset_id},
    )
    assert created.status_code == 201
    item_id = created.json()["id"]

    deleted = await client.delete(f"/api/v1/worksets/{workset_id}")
    assert deleted.status_code == 200

    fetched = await client.get(f"/api/v1/items/{item_id}")
    assert fetched.status_code == 200
    assert fetched.json()["worksetId"] == SYSTEM_WORKSET_ID


@pytest.mark.asyncio
async def test_patch_item_workset_syncs_linked_calendars(client):
    ws_a = await client.post("/api/v1/worksets", json={"name": "Team A"})
    ws_b = await client.post("/api/v1/worksets", json={"name": "Team B"})
    assert ws_a.status_code == 201
    assert ws_b.status_code == 201
    workset_a = ws_a.json()["id"]
    workset_b = ws_b.json()["id"]

    created = await client.post(
        "/api/v1/items",
        json={"title": "Badge", "worksetId": workset_a},
    )
    assert created.status_code == 201
    item_id = created.json()["id"]

    ev = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "到期",
            "startTime": "2030-01-01T00:00:00Z",
            "isAllDay": True,
            "itemId": item_id,
            "worksetId": workset_a,
        },
    )
    assert ev.status_code == 201
    event_id = ev.json()["id"]

    recurring = await client.post(
        "/api/v1/tasks/recurring",
        json={
            "name": "Weekly check",
            "rrule": "FREQ=WEEKLY;BYDAY=MO",
            "eventStartTime": "09:00",
            "worksetId": workset_a,
            "itemId": item_id,
        },
    )
    assert recurring.status_code == 201
    assert recurring.json()["id"]

    patched = await client.patch(
        f"/api/v1/items/{item_id}",
        json={"worksetId": workset_b},
    )
    assert patched.status_code == 200
    assert patched.json()["worksetId"] == workset_b

    fetched_ev = await client.get(f"/api/v1/calendar/user-events/{event_id}")
    assert fetched_ev.status_code == 200
    assert fetched_ev.json()["worksetId"] == workset_b

    fetched_task = await client.get(
        "/api/v1/tasks",
        params={"itemId": item_id, "analysisMode": "recurring"},
    )
    assert fetched_task.status_code == 200
    assert len(fetched_task.json()) == 1
    assert fetched_task.json()[0]["worksetId"] == workset_b

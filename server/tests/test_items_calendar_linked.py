"""Linked item calendar dates: expires cache, kind inference, finance."""

from __future__ import annotations

import pytest


async def test_linked_expiry_event_updates_item_expires_at(client):
    created = await client.post("/api/v1/items", json={"title": "牛奶"})
    assert created.status_code == 201
    item_id = created.json()["id"]
    assert created.json()["expiresAt"] is None

    event = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "Expires",
            "kind": "expires",
            "startTime": "2026-08-10T00:00:00Z",
            "isAllDay": True,
            "itemId": item_id,
            "remindBeforeDays": 3,
        },
    )
    assert event.status_code == 201

    fetched = await client.get(f"/api/v1/items/{item_id}")
    assert fetched.status_code == 200
    assert fetched.json()["expiresAt"] == "2026-08-10"
    assert fetched.json()["remindBeforeDays"] == 3

    dismissed = await client.delete(f"/api/v1/calendar/user-events/{event.json()['id']}")
    assert dismissed.status_code == 204

    after = await client.get(f"/api/v1/items/{item_id}")
    assert after.status_code == 200
    assert after.json()["expiresAt"] is None
    assert after.json()["remindBeforeDays"] is None


@pytest.mark.asyncio
async def test_linked_purchased_event_does_not_sync_item_cache(client):
    """Linked「購入」is a normal calendar — does not drive wire expiresAt."""
    created = await client.post("/api/v1/items", json={"title": "Gadget"})
    assert created.status_code == 201
    item_id = created.json()["id"]

    event = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "購入",
            "kind": "purchase_effective",
            "startTime": "2026-07-20T00:00:00Z",
            "isAllDay": True,
            "itemId": item_id,
        },
    )
    assert event.status_code == 201

    fetched = await client.get(f"/api/v1/items/{item_id}")
    assert fetched.status_code == 200
    assert "purchasedAt" not in fetched.json()
    assert fetched.json()["expiresAt"] is None


@pytest.mark.asyncio
async def test_list_items_without_linked_expires_has_null_dates(client, app):
    """GET list derives dates; item with no kind=expires link has null expiry fields."""
    from server.tests.items_helpers import seed_item_row
    from server.util import new_id

    item_id = new_id()
    await seed_item_row(app.state.db, item_id=item_id, title="orphan yogurt")

    listed = await client.get("/api/v1/items")
    assert listed.status_code == 200
    row = next(r for r in listed.json() if r["id"] == item_id)
    assert row["expiresAt"] is None
    assert row["remindBeforeDays"] is None

    linked = await client.get("/api/v1/calendar/user-events", params={"itemId": item_id})
    assert linked.status_code == 200
    assert linked.json()["items"] == []


@pytest.mark.asyncio
async def test_get_item_without_linked_expires_has_null_dates(client, app):
    """GET /items/{id} derives dates; no kind=expires link → null expiry fields."""
    from server.tests.items_helpers import seed_item_row
    from server.util import new_id

    item_id = new_id()
    await seed_item_row(app.state.db, item_id=item_id, title="orphan yogurt get")

    fetched = await client.get(f"/api/v1/items/{item_id}")
    assert fetched.status_code == 200
    assert fetched.json()["expiresAt"] is None
    assert fetched.json()["remindBeforeDays"] is None

    linked = await client.get("/api/v1/calendar/user-events", params={"itemId": item_id})
    assert linked.status_code == 200
    assert linked.json()["items"] == []


@pytest.mark.asyncio
async def test_list_items_linked_expiry_drives_expires_at(client):
    """Linked「到期」is the only SoT that populates list expiresAt / badges."""
    created = await client.post("/api/v1/items", json={"title": "Linked milk"})
    assert created.status_code == 201
    item_id = created.json()["id"]
    assert created.json()["expiresAt"] is None

    event = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "到期",
            "kind": "expires",
            "startTime": "2026-08-12T00:00:00Z",
            "isAllDay": True,
            "itemId": item_id,
            "remindBeforeDays": 4,
        },
    )
    assert event.status_code == 201

    listed = await client.get("/api/v1/items")
    row = next(r for r in listed.json() if r["id"] == item_id)
    assert row["expiresAt"] == "2026-08-12"
    assert row["remindBeforeDays"] == 4


@pytest.mark.asyncio
async def test_multiple_linked_expiry_primary_is_first_created(client, app):
    """Multiple linked expiries allowed; item cache follows earliest created_at primary."""
    created = await client.post("/api/v1/items", json={"title": "Milk"})
    assert created.status_code == 201
    item_id = created.json()["id"]

    first = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "Expires",
            "kind": "expires",
            "startTime": "2026-08-01T00:00:00Z",
            "isAllDay": True,
            "itemId": item_id,
            "remindBeforeDays": 2,
        },
    )
    assert first.status_code == 201
    first_id = first.json()["id"]

    await app.state.db.execute(
        "UPDATE user_events SET created_at = ? WHERE id = ?",
        ("2026-01-01T00:00:00.000Z", first_id),
    )

    second = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "Expires",
            "kind": "expires",
            "startTime": "2026-08-10T00:00:00Z",
            "isAllDay": True,
            "itemId": item_id,
            "remindBeforeDays": 9,
        },
    )
    assert second.status_code == 201
    second_id = second.json()["id"]

    await app.state.db.execute(
        "UPDATE user_events SET created_at = ? WHERE id = ?",
        ("2026-02-01T00:00:00.000Z", second_id),
    )

    fetched = await client.get(f"/api/v1/items/{item_id}")
    assert fetched.status_code == 200
    assert fetched.json()["expiresAt"] == "2026-08-01"
    assert fetched.json()["remindBeforeDays"] == 2

    deleted = await client.delete(f"/api/v1/calendar/user-events/{first_id}")
    assert deleted.status_code == 204

    promoted = await client.get(f"/api/v1/items/{item_id}")
    assert promoted.status_code == 200
    assert promoted.json()["expiresAt"] == "2026-08-10"
    assert promoted.json()["remindBeforeDays"] == 9

    # Sanity: second event still exists
    ev = await client.get(f"/api/v1/calendar/user-events/{second_id}")
    assert ev.status_code == 200


@pytest.mark.asyncio
async def test_update_linked_expiry_title_still_allowed(client):
    """Renaming an expires event keeps kind + item expiresAt projection."""
    created = await client.post("/api/v1/items", json={"title": "Passport"})
    item_id = created.json()["id"]
    event = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "到期",
            "kind": "expires",
            "startTime": "2026-08-01T00:00:00Z",
            "isAllDay": True,
            "itemId": item_id,
            "remindBeforeDays": 2,
        },
    )
    event_id = event.json()["id"]
    assert event.json()["kind"] == "expires"
    assert (await client.get(f"/api/v1/items/{item_id}")).json()["expiresAt"] == "2026-08-01"

    patched = await client.patch(
        f"/api/v1/calendar/user-events/{event_id}",
        json={"title": "保修到期", "startTime": "2026-09-01T00:00:00Z", "remindBeforeDays": 5},
    )
    assert patched.status_code == 200
    body = patched.json()
    assert body["title"] == "保修到期"
    assert body["kind"] == "expires"
    assert body["startTime"].startswith("2026-09-01")
    assert (await client.get(f"/api/v1/items/{item_id}")).json()["expiresAt"] == "2026-09-01"


@pytest.mark.asyncio
async def test_rename_purchase_effective_keeps_finance(client):
    """Title edits must not drop purchase_effective finance fields."""
    created = await client.post("/api/v1/items", json={"title": "Camera"})
    item_id = created.json()["id"]
    event = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "購入",
            "kind": "purchase_effective",
            "startTime": "2026-08-05T10:00:00Z",
            "itemId": item_id,
            "amount": 1280.5,
            "direction": "expense",
        },
    )
    assert event.status_code == 201
    event_id = event.json()["id"]

    patched = await client.patch(
        f"/api/v1/calendar/user-events/{event_id}",
        json={"title": "双十一相机"},
    )
    assert patched.status_code == 200
    body = patched.json()
    assert body["title"] == "双十一相机"
    assert body["kind"] == "purchase_effective"
    assert body["amount"] == 1280.5
    assert body["direction"] == "expense"


@pytest.mark.asyncio
async def test_title_does_not_infer_kind_on_create_or_patch(client):
    """Normal events titled 「到期」 stay normal; amount clears unless purchase_effective."""
    titled = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "到期",
            "startTime": "2026-08-01T00:00:00Z",
            "isAllDay": True,
            "amount": 12,
        },
    )
    assert titled.status_code == 201
    assert titled.json()["kind"] == "normal"
    assert titled.json()["amount"] is None

    event_id = titled.json()["id"]
    patched = await client.patch(
        f"/api/v1/calendar/user-events/{event_id}",
        json={"title": "購入", "amount": 50},
    )
    assert patched.status_code == 200
    assert patched.json()["kind"] == "normal"
    assert patched.json()["amount"] is None

    purchase = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "Misc",
            "kind": "purchase_effective",
            "startTime": "2026-08-05T10:00:00Z",
            "amount": 9,
        },
    )
    purchase_id = purchase.json()["id"]
    demoted = await client.patch(
        f"/api/v1/calendar/user-events/{purchase_id}",
        json={"kind": "normal"},
    )
    assert demoted.status_code == 200
    assert demoted.json()["kind"] == "normal"
    assert demoted.json()["amount"] is None
    assert demoted.json()["direction"] is None


@pytest.mark.asyncio
async def test_delete_linked_expiry_clears_item_cache(client):
    """Dismissing linked「到期」clears derive-on-read list badges."""
    created = await client.post(
        "/api/v1/items",
        json={"title": "Dismissed expiry"},
    )
    assert created.status_code == 201
    item_id = created.json()["id"]
    event = await client.post(
        "/api/v1/calendar/user-events",
        json={
            "title": "到期",
            "kind": "expires",
            "startTime": "2026-08-01T00:00:00Z",
            "isAllDay": True,
            "itemId": item_id,
            "remindBeforeDays": 2,
        },
    )
    assert event.status_code == 201
    assert (await client.get(f"/api/v1/items/{item_id}")).json()["expiresAt"] == "2026-08-01"

    dismissed = await client.delete(f"/api/v1/calendar/user-events/{event.json()['id']}")
    assert dismissed.status_code == 204

    listed = await client.get("/api/v1/items")
    row = next(r for r in listed.json() if r["id"] == item_id)
    assert row["expiresAt"] is None
    assert row["remindBeforeDays"] is None

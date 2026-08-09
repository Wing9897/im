"""Items domain tests (split from former monolith)."""

from __future__ import annotations

import pytest

from server.worksets_const import SYSTEM_WORKSET_ID

async def test_items_change_category_keeps_attributes(client):
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
    passport_seed = next(c for c in seed if c["slug"] == "passport_docs")
    assert passport_seed.get("emoji")
    passport = next(c for c in seed if c["slug"] == "passport_docs")
    food = next(c for c in seed if c["slug"] == "food")

    created = await client.post(
        "/api/v1/items",
        json={
            "title": "護照",
            "categoryId": passport["id"],
            "worksetId": SYSTEM_WORKSET_ID,
            "attributes": {"id_number": "A123", "custom": "keep"},
        },
    )
    assert created.status_code == 201
    item = created.json()
    assert item["attributes"]["id_number"] == "A123"
    assert item["attributes"]["custom"] == "keep"
    # Copy-on-create seeds remaining category preset keys as empty strings.
    assert item["attributes"]["issuer"] == ""
    assert item["remindBeforeDays"] is None
    assert item["expiresAt"] is None

    patched = await client.patch(
        f"/api/v1/items/{item['id']}",
        json={"categoryId": food["id"]},
    )
    assert patched.status_code == 200
    body = patched.json()
    assert body["categoryId"] == food["id"]
    assert body["attributes"]["id_number"] == "A123"
    assert body["attributes"]["custom"] == "keep"
    assert body["attributes"]["issuer"] == ""
    # Date cache is untouched by category changes (SoT = linked calendars).
    assert body["remindBeforeDays"] is None


@pytest.mark.asyncio
async def test_create_item_seeds_category_field_schema_keys(client):
    """Create copies category fieldSchema keys into attributes (empty unless provided)."""
    cats = await client.get("/api/v1/items/categories")
    passport = next(c for c in cats.json() if c["slug"] == "passport_docs")

    empty = await client.post(
        "/api/v1/items",
        json={
            "title": "證件一",
            "categoryId": passport["id"],
            "worksetId": SYSTEM_WORKSET_ID,
        },
    )
    assert empty.status_code == 201
    attrs = empty.json()["attributes"]
    assert attrs.get("id_number") == ""
    assert attrs.get("issuer") == ""

    partial = await client.post(
        "/api/v1/items",
        json={
            "title": "證件二",
            "categoryId": passport["id"],
            "worksetId": SYSTEM_WORKSET_ID,
            "attributes": {"id_number": "B999"},
        },
    )
    assert partial.status_code == 201
    partial_attrs = partial.json()["attributes"]
    assert partial_attrs["id_number"] == "B999"
    assert partial_attrs["issuer"] == ""


@pytest.mark.asyncio
async def test_patch_category_field_schema_does_not_rewrite_item_attributes(client):
    """Category template edits are not live inheritance — existing items stay put."""
    created_cat = await client.post(
        "/api/v1/items/categories",
        json={
            "name": "TempDocs",
            "fieldSchema": [{"key": "id", "label": "ID"}],
        },
    )
    assert created_cat.status_code == 201
    cat = created_cat.json()

    created_item = await client.post(
        "/api/v1/items",
        json={
            "title": "Doc A",
            "categoryId": cat["id"],
            "worksetId": SYSTEM_WORKSET_ID,
            "attributes": {"id": "x1"},
        },
    )
    assert created_item.status_code == 201
    item = created_item.json()
    assert item["attributes"] == {"id": "x1"}

    patched_cat = await client.patch(
        f"/api/v1/items/categories/{cat['id']}",
        json={
            "fieldSchema": [
                {"key": "id", "label": "ID"},
                {"key": "issuer", "label": "Issuer"},
            ],
        },
    )
    assert patched_cat.status_code == 200
    assert len(patched_cat.json()["fieldSchema"]) == 2

    fetched = await client.get(f"/api/v1/items/{item['id']}")
    assert fetched.status_code == 200
    assert fetched.json()["attributes"] == {"id": "x1"}


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


def test_seed_attributes_from_field_schema():
    from server.items.normalize import seed_attributes_from_field_schema

    seeded = seed_attributes_from_field_schema(
        {"id_number": "A1"},
        [
            {"key": "id_number", "label": "ID"},
            {"key": "issuer", "label": "Issuer"},
        ],
    )
    assert seeded == {"id_number": "A1", "issuer": ""}
    # Existing empty values are not overwritten.
    assert seed_attributes_from_field_schema(
        {"issuer": "Gov"},
        [{"key": "issuer", "label": "Issuer"}],
    ) == {"issuer": "Gov"}


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
    with pytest.raises(ItemValidationError, match="reserved"):
        normalize_attributes({"到期": "2027-01-01"})
    with pytest.raises(ItemValidationError, match="reserved"):
        normalize_attributes({"Expires": "note"})


def test_normalize_field_schema_rejects_reserved_keys():
    from server.items.normalize import ItemValidationError, normalize_field_schema

    with pytest.raises(ItemValidationError, match="reserved"):
        normalize_field_schema([{"key": "到期", "label": "到期日"}])
    with pytest.raises(ItemValidationError, match="reserved"):
        normalize_field_schema([{"key": "Expires", "label": "Expiry"}])


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
    task_id = recurring.json()["id"]

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

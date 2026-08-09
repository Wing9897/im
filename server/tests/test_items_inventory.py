"""Items domain tests (split from former monolith)."""

from __future__ import annotations

import pytest

from server.agent.tools_items import execute_items_tool

async def test_item_create_and_patch_quantity_unit_price(client):
    created = await client.post(
        "/api/v1/items",
        json={
            "title": "Milk",
            "quantity": 1.5,
            "unit": "升",
            "price": 42.5,
        },
    )
    assert created.status_code == 201
    body = created.json()
    assert body["quantity"] == 1.5
    assert body["unit"] == "升"
    assert body["price"] == 42.5
    item_id = body["id"]

    patched = await client.patch(
        f"/api/v1/items/{item_id}",
        json={"quantity": 3, "unit": "盒", "price": 1280},
    )
    assert patched.status_code == 200
    updated = patched.json()
    assert updated["quantity"] == 3
    assert updated["unit"] == "盒"
    assert updated["price"] == 1280

    cleared = await client.patch(
        f"/api/v1/items/{item_id}",
        json={"quantity": None, "unit": None, "price": None},
    )
    assert cleared.status_code == 200
    empty = cleared.json()
    assert empty["quantity"] is None
    assert empty["unit"] is None
    assert empty["price"] is None


@pytest.mark.asyncio
async def test_item_create_rejects_invalid_inventory_fields(client):
    bad_quantity = await client.post(
        "/api/v1/items",
        json={"title": "Bad qty", "quantity": -1},
    )
    assert bad_quantity.status_code == 422

    bad_price = await client.post(
        "/api/v1/items",
        json={"title": "Bad price", "price": "free"},
    )
    assert bad_price.status_code == 422


@pytest.mark.asyncio
async def test_list_items_search_matches_inventory_fields(client):
    created = await client.post(
        "/api/v1/items",
        json={
            "title": "Stock item",
            "quantity": 2.5,
            "unit": "kg",
            "price": 19.9,
        },
    )
    assert created.status_code == 201
    item_id = created.json()["id"]

    for needle, expect_hit in [("kg", True), ("2.5", True), ("19.9", True), ("nomatch", False)]:
        listed = await client.get("/api/v1/items", params={"search": needle})
        assert listed.status_code == 200
        ids = {row["id"] for row in listed.json()}
        assert (item_id in ids) is expect_hit, needle


@pytest.mark.asyncio
async def test_agent_create_item_with_inventory_fields(app):
    result = await execute_items_tool(
        app.state.db,
        "items.create",
        {
            "title": "Agent stock",
            "quantity": 6,
            "unit": "瓶",
            "price": 19.99,
        },
    )
    assert result.get("created") is True
    item = result["item"]
    assert item["quantity"] == 6
    assert item["unit"] == "瓶"
    assert item["price"] == 19.99


@pytest.mark.asyncio
async def test_agent_list_items_with_filters(app):
    created = await execute_items_tool(
        app.state.db,
        "items.create",
        {
            "title": "Filter me",
            "quantity": 2,
            "unit": "盒",
            "price": 12.5,
            "attributes": {"brand": "TestCo"},
        },
    )
    assert created.get("created") is True
    item_id = created["item"]["id"]

    listed = await execute_items_tool(app.state.db, "items.list", {"search": "Filter", "limit": 10})
    assert listed["count"] >= 1
    row = next(item for item in listed["items"] if item["id"] == item_id)
    assert row["quantity"] == 2
    assert row["unit"] == "盒"
    assert row["price"] == 12.5
    assert row["attributes"]["brand"] == "TestCo"

    empty = await execute_items_tool(app.state.db, "items.list", {"search": "nomatch-xyz"})
    assert empty["count"] == 0


@pytest.mark.asyncio
async def test_agent_update_item_inventory_fields(app):
    created = await execute_items_tool(
        app.state.db,
        "items.create",
        {"title": "Before update"},
    )
    item_id = created["item"]["id"]

    updated = await execute_items_tool(
        app.state.db,
        "items.update",
        {
            "id": item_id,
            "title": "After update",
            "quantity": 1.5,
            "unit": "kg",
            "price": 8.8,
            "notes": "agent patch",
        },
    )
    assert updated.get("updated") is True
    item = updated["item"]
    assert item["title"] == "After update"
    assert item["quantity"] == 1.5
    assert item["unit"] == "kg"
    assert item["price"] == 8.8
    assert item["notes"] == "agent patch"

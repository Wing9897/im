"""Shared messages query layer matches REST page behaviour."""

from __future__ import annotations

from server.queries.messages_queries import MessagesQueryError, build_message_filters, fetch_messages_page
from server.tests import seed


async def test_build_message_filters_search_and_platform() -> None:
    where, params = build_message_filters(None, "7d", "hello", "telegram", None)
    assert "LIKE" in where
    assert "m.platform = ?" in where
    assert any(isinstance(p, str) and "hello" in p for p in params)
    assert params[-1] == "telegram"


async def test_build_message_filters_rejects_long_search() -> None:
    try:
        build_message_filters(None, None, "x" * 501, None, None)
        raise AssertionError("expected MessagesQueryError")
    except MessagesQueryError as exc:
        assert "500" in str(exc)


async def test_fetch_messages_page_finds_seeded_content(app) -> None:
    page = await fetch_messages_page(app.state.db, search="sender-1", limit=10, include_total=True)
    assert page["totalCount"] is not None
    assert page["totalCount"] >= 1
    assert any(m["id"] == seed.MESSAGE_1 for m in page["messages"])


async def test_messages_page_route_still_works(client) -> None:
    resp = await client.get("/api/v1/messages/page", params={"search": "sender-1", "limit": "5"})
    assert resp.status_code == 200
    body = resp.json()
    assert "messages" in body
    assert any(m["id"] == seed.MESSAGE_1 for m in body["messages"])

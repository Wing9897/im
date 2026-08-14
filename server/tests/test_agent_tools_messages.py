"""Agent messages.search tool limits and compact payload."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from server.agent.tools_messages import HARD_CAP, execute_messages_tool
from server.agent.tools_registry import execute_tool
from server.tests import seed
from server.time_iso import to_iso_z
from server.util import utc_now_iso


async def test_messages_search_requires_query(app) -> None:
    result = await execute_messages_tool(app.state.db, "messages.search", {})
    assert "error" in result
    assert result["count"] == 0


async def test_messages_search_defaults_time_range_to_7d(app) -> None:
    result = await execute_messages_tool(
        app.state.db,
        "messages.search",
        {"query": "sender-1", "limit": 10},
    )
    assert "error" not in result
    assert result["timeRange"] == "7d"
    # Seed messages are dated 2026-07-01; outside a live last-7-days window.
    assert not any(item["id"] == seed.MESSAGE_1 for item in result["items"])


async def test_messages_search_all_escapes_time_window(app) -> None:
    result = await execute_messages_tool(
        app.state.db,
        "messages.search",
        {"query": "sender-1", "timeRange": "all", "limit": 10},
    )
    assert "error" not in result
    assert result["timeRange"] == "all"
    assert result["count"] >= 1
    item = next(i for i in result["items"] if i["id"] == seed.MESSAGE_1)
    assert "content" in item
    assert "timestamp" in item
    assert "rawData" not in item
    assert "media" not in item


async def test_messages_search_preserves_snake_case_argument_alias(app) -> None:
    result = await execute_messages_tool(
        app.state.db,
        "messages.search",
        {"query": "sender-1", "time_range": "all"},
    )
    assert result["timeRange"] == "all"
    assert any(item["id"] == seed.MESSAGE_1 for item in result["items"])


async def test_messages_search_rejects_removed_full_history_alias(app) -> None:
    removed_token = "".join(("all", "time"))
    result = await execute_messages_tool(
        app.state.db,
        "messages.search",
        {"query": "sender-1", "timeRange": removed_token},
    )
    assert "error" in result
    assert result["items"] == []
    assert result["count"] == 0


async def test_messages_search_7d_finds_recent_message(app) -> None:
    recent_ts = to_iso_z(datetime.now(UTC) - timedelta(days=1))
    await app.state.db.execute(
        "INSERT INTO messages (id, source_id, platform, platform_id, "
        "platform_message_id, sender_id, sender_name, content, timestamp, "
        "raw_data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)",
        (
            "msg-recent-agent",
            seed.TG_SOURCE,
            *seed.TG_CHANNEL,
            "9001",
            "sender-recent",
            "Recent",
            "agent-default-window-hit",
            recent_ts,
            utc_now_iso(),
        ),
    )
    result = await execute_messages_tool(
        app.state.db,
        "messages.search",
        {"query": "agent-default-window-hit"},
    )
    assert result["timeRange"] == "7d"
    assert any(item["id"] == "msg-recent-agent" for item in result["items"])


async def test_messages_search_hard_caps_limit(app) -> None:
    result = await execute_messages_tool(
        app.state.db,
        "messages.search",
        {"query": "a", "timeRange": "all", "limit": 10_000},
    )
    assert result["limit"] == HARD_CAP
    assert len(result["items"]) <= HARD_CAP


async def test_registry_dispatches_messages_search(app) -> None:
    result = await execute_tool(
        app.state.db,
        "messages.search",
        {"query": "sender-1", "timeRange": "all"},
        context={},
    )
    assert result["count"] >= 1
    assert result["timeRange"] == "all"

"""Household MCP/A2A workset visibility: ``worksets.external_enabled``."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from server.agent.mcp_tools import execute_mcp_tool
from server.agent.runtime import AgentRuntime
from server.analyzer.llm_client import ConfigurableLlmClient
from server.auth.access_keys import FULL_SCOPE, seed_access_key
from server.db.database import TransactionDb
from server.queries.worksets_queries import insert_workset
from server.tests import seed
from server.tests.db_helpers import insert_channel, insert_direct_analysis_task
from server.tests.items_helpers import seed_item_row
from server.util import utc_now_iso
from server.worksets_const import SYSTEM_WORKSET_ID

WS_A = "ws-allow-a"
WS_B = "ws-allow-b"


def _auth_headers(secret: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {secret}",
        "Accept": "application/json, text/event-stream",
        "Content-Type": "application/json",
    }


async def _insert_named_workset(db, workset_id: str, name: str) -> None:
    now = utc_now_iso()
    async with db.transaction() as conn:
        await insert_workset(TransactionDb(conn), workset_id=workset_id, name=name, now=now)


async def _set_external_enabled(db, *workset_ids: str) -> None:
    await db.execute("UPDATE worksets SET external_enabled = 0")
    for workset_id in workset_ids:
        await db.execute("UPDATE worksets SET external_enabled = 1 WHERE id = ?", (workset_id,))


async def _partition_seed_worksets(db) -> None:
    await _insert_named_workset(db, WS_A, "Allow A")
    await _insert_named_workset(db, WS_B, "Allow B")
    await db.execute("UPDATE analysis_tasks SET workset_id = ? WHERE id = ?", (WS_A, seed.TASK_EVENT))
    await db.execute(
        "UPDATE analysis_tasks SET workset_id = ? WHERE id = ?",
        (WS_B, seed.TASK_EVENT_TIMED),
    )


@pytest.mark.asyncio
async def test_mcp_default_external_enabled_lists_every_workset_intelligence_messages_items(app) -> None:
    await _partition_seed_worksets(app.state.db)
    await seed_item_row(app.state.db, item_id="item-ws-b", title="ops-only-item", workset_id=WS_B)

    intel = await execute_mcp_tool(
        app.state.db, "intelligence.search_events", {"allTime": True}, broadcaster=app.state.broadcaster
    )
    ids = {item["id"] for item in intel["items"]}
    assert "ben-1" in ids
    assert "ev-1" in ids

    messages = await execute_mcp_tool(
        app.state.db,
        "messages.search",
        {"query": "地震", "timeRange": "all"},
        broadcaster=app.state.broadcaster,
    )
    assert any("地震" in str(item.get("content") or "") for item in messages["items"])

    items = await execute_mcp_tool(app.state.db, "items.list", {}, broadcaster=app.state.broadcaster)
    titles = {item["title"] for item in items["items"]}
    assert "護照樣本" in titles
    assert "ops-only-item" in titles


@pytest.mark.asyncio
async def test_mcp_external_disabled_hides_other_worksets_on_intelligence_messages_items(client, app) -> None:
    await _partition_seed_worksets(app.state.db)
    await seed_item_row(app.state.db, item_id="item-ws-a", title="alpha-item", workset_id=WS_A)
    await seed_item_row(app.state.db, item_id="item-ws-b", title="ops-only-item", workset_id=WS_B)
    await insert_channel(app.state.db, "telegram", "ops-only", channel_name="Ops only")
    await insert_direct_analysis_task(app.state.db, "task-ops-ws", analysis_mode="intel_event", name="Ops")
    await app.state.db.execute(
        "UPDATE analysis_tasks SET workset_id = ? WHERE id = ?",
        (WS_B, "task-ops-ws"),
    )
    await app.state.db.execute(
        "INSERT INTO task_channels (task_id, platform, platform_id) VALUES (?, ?, ?)",
        ("task-ops-ws", "telegram", "ops-only"),
    )
    now = utc_now_iso()
    await app.state.db.execute(
        "INSERT INTO messages (id, source_id, platform, platform_id, platform_message_id, "
        "sender_id, sender_name, content, timestamp, raw_data, created_at) "
        "VALUES (?, NULL, 'telegram', 'ops-only', 'ops-1', 's', 'Ops', 'secret-ops-payload', ?, NULL, ?)",
        ("msg-ops-only", now, now),
    )
    await _set_external_enabled(app.state.db, WS_A)

    intel = await execute_mcp_tool(
        app.state.db, "intelligence.search_events", {"allTime": True}, broadcaster=app.state.broadcaster
    )
    ids = {item["id"] for item in intel["items"]}
    assert "ben-1" in ids
    assert "ev-1" not in ids

    hidden_msgs = await execute_mcp_tool(
        app.state.db,
        "messages.search",
        {"query": "secret-ops-payload", "timeRange": "all"},
        broadcaster=app.state.broadcaster,
    )
    assert hidden_msgs["items"] == []
    visible_msgs = await execute_mcp_tool(
        app.state.db,
        "messages.search",
        {"query": "地震", "timeRange": "all"},
        broadcaster=app.state.broadcaster,
    )
    assert any("地震" in str(item.get("content") or "") for item in visible_msgs["items"])

    items = await execute_mcp_tool(app.state.db, "items.list", {}, broadcaster=app.state.broadcaster)
    titles = {item["title"] for item in items["items"]}
    assert "alpha-item" in titles
    assert "ops-only-item" not in titles
    assert "護照樣本" not in titles
    assert all(item.get("worksetId") == WS_A for item in items["items"])

    denied = await execute_mcp_tool(
        app.state.db,
        "items.create",
        {"title": "Should fail", "worksetId": WS_B},
        broadcaster=app.state.broadcaster,
    )
    assert denied["error"] == "workset not allowed"

    calendar = await execute_mcp_tool(
        app.state.db, "calendar.upcoming", {"days": 1}, broadcaster=app.state.broadcaster
    )
    assert "error" not in calendar

    key = await seed_access_key(app.state.db, "mcp-ws-http", scopes=[FULL_SCOPE])
    listed = await client.post(
        "/api/v1/mcp",
        json={
            "jsonrpc": "2.0",
            "id": 40,
            "method": "tools/call",
            "params": {"name": "intelligence.search_events", "arguments": {"allTime": True}},
        },
        headers=_auth_headers(key["key"]),
    )
    assert listed.status_code == 200
    http_ids = {item["id"] for item in listed.json()["result"]["structuredContent"]["items"]}
    assert "ben-1" in http_ids
    assert "ev-1" not in http_ids


@pytest.mark.asyncio
async def test_mcp_all_external_disabled_fails_closed_for_workset_tools(app) -> None:
    await _partition_seed_worksets(app.state.db)
    await _set_external_enabled(app.state.db)

    intel = await execute_mcp_tool(
        app.state.db, "intelligence.search_events", {"allTime": True}, broadcaster=app.state.broadcaster
    )
    assert intel["items"] == []

    messages = await execute_mcp_tool(
        app.state.db,
        "messages.search",
        {"query": "地震", "timeRange": "all"},
        broadcaster=app.state.broadcaster,
    )
    assert messages["items"] == []

    items = await execute_mcp_tool(app.state.db, "items.list", {}, broadcaster=app.state.broadcaster)
    assert items["items"] == []

    created = await execute_mcp_tool(
        app.state.db,
        "items.create",
        {"title": "no workset"},
        broadcaster=app.state.broadcaster,
    )
    assert created["error"] == "workset not allowed"


@pytest.mark.asyncio
async def test_a2a_enforces_external_enabled_worksets(client, app) -> None:
    await _partition_seed_worksets(app.state.db)
    await seed_item_row(app.state.db, item_id="item-ws-b", title="ops-only-item", workset_id=WS_B)
    await _set_external_enabled(app.state.db, SYSTEM_WORKSET_ID)

    key = await seed_access_key(app.state.db, "a2a-ws-secret", scopes=[FULL_SCOPE])
    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.complete = AsyncMock(
        side_effect=[
            {
                "text": json.dumps(
                    {
                        "tool_calls": [
                            {"name": "items.list", "arguments": {}},
                        ]
                    }
                )
            },
            {"text": json.dumps({"message": "listed"})},
        ]
    )
    mock_llm.close = AsyncMock()
    mock_llm.provider = "ollama"

    with patch.object(ConfigurableLlmClient, "from_liaison_slot", AsyncMock(return_value=mock_llm)):
        resp = await client.post(
            "/api/v1/a2a/agent",
            json={"input": "列出物品"},
            headers={"Authorization": f"Bearer {key['key']}"},
        )

    assert resp.status_code == 200
    body = resp.json()
    summary = " ".join(str(t.get("resultSummary") or "") for t in body.get("toolCalls") or [])
    assert "items.list: 2 items" in summary
    assert "items.list: 3 items" not in summary


@pytest.mark.asyncio
async def test_assistant_ignores_household_external_enabled(app) -> None:
    await _partition_seed_worksets(app.state.db)
    await seed_item_row(app.state.db, item_id="item-ws-b", title="ops-only-item", workset_id=WS_B)
    await _set_external_enabled(app.state.db, SYSTEM_WORKSET_ID)

    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.complete = AsyncMock(
        side_effect=[
            {
                "text": json.dumps(
                    {
                        "tool_calls": [
                            {"name": "items.list", "arguments": {}},
                        ]
                    }
                )
            },
            {"text": json.dumps({"message": "ok"})},
        ]
    )
    mock_llm.close = AsyncMock()

    runtime = AgentRuntime(app.state.db, mock_llm, broadcaster=app.state.broadcaster)
    result = await runtime.chat(
        [{"role": "user", "content": "列出物品"}],
        channel="assistant",
        session_id="sess-assistant-worksets",
    )
    summary = " ".join(str(t.get("resultSummary") or "") for t in result.get("toolCalls") or [])
    assert "items.list: 3 items" in summary


def _workset_ids(payload: dict) -> set[str]:
    return {str(row["id"]) for row in payload.get("worksets") or []}


@pytest.mark.asyncio
async def test_mcp_worksets_list_filters_external_enabled(app) -> None:
    await _partition_seed_worksets(app.state.db)
    await _set_external_enabled(app.state.db, WS_A)

    listed = await execute_mcp_tool(app.state.db, "worksets.list", {}, broadcaster=app.state.broadcaster)
    ids = _workset_ids(listed)
    assert WS_A in ids
    assert WS_B not in ids
    assert SYSTEM_WORKSET_ID not in ids
    row = next(item for item in listed["worksets"] if item["id"] == WS_A)
    assert row["name"] == "Allow A"
    assert "notifyEnabled" in row
    assert "externalEnabled" in row
    assert row["externalEnabled"] is True


@pytest.mark.asyncio
async def test_mcp_worksets_list_fail_closed_when_all_external_off(app) -> None:
    await _partition_seed_worksets(app.state.db)
    await _set_external_enabled(app.state.db)

    listed = await execute_mcp_tool(app.state.db, "worksets.list", {}, broadcaster=app.state.broadcaster)
    assert listed["worksets"] == []
    assert listed["count"] == 0


@pytest.mark.asyncio
async def test_assistant_worksets_list_sees_all(app) -> None:
    from server.agent.tools_registry import execute_tool

    await _partition_seed_worksets(app.state.db)
    await _set_external_enabled(app.state.db, WS_A)

    listed = await execute_tool(app.state.db, "worksets.list", {})
    ids = _workset_ids(listed)
    assert WS_A in ids
    assert WS_B in ids
    assert SYSTEM_WORKSET_ID in ids

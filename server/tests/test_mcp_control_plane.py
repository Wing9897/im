"""MCP Streamable HTTP control plane: auth, allowlist, origin=mcp writes."""

from __future__ import annotations

from typing import Any

import pytest

from server.agent.mcp_tools import (
    MCP_CONFIRM_REQUIRED_ERROR,
    MCP_TOOL_ALLOWLIST,
    execute_mcp_tool,
    mcp_tool_schemas,
)
from server.agent.tools_registry import CALENDAR_WRITE_TOOL_NAMES
from server.auth.access_keys import FULL_SCOPE, READ_SCOPE, seed_access_key
from server.auth.device_auth import create_device_session
from server.config import set_configs


def _auth_headers(secret: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {secret}",
        "Accept": "application/json, text/event-stream",
        "Content-Type": "application/json",
    }


def _mcp_headers_no_auth() -> dict[str, str]:
    return {
        "Accept": "application/json, text/event-stream",
        "Content-Type": "application/json",
    }


async def _mcp_post(client, path: str, body: dict[str, Any], headers: dict[str, str]):
    return await client.post(path, json=body, headers=headers)


@pytest.mark.asyncio
async def test_mcp_rejects_missing_and_device_session(client, app) -> None:
    missing = await _mcp_post(
        client,
        "/api/v1/mcp",
        {"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
        _mcp_headers_no_auth(),
    )
    assert missing.status_code == 403

    tokens = await create_device_session(app.state.db, label="UI")
    device = await _mcp_post(
        client,
        "/api/v1/mcp",
        {"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
        _auth_headers(tokens["accessToken"]),
    )
    assert device.status_code == 403


@pytest.mark.asyncio
async def test_mcp_rejects_read_only_key(client, app) -> None:
    key = await seed_access_key(app.state.db, "mcp-read-secret", scopes=[READ_SCOPE])
    resp = await _mcp_post(
        client,
        "/api/v1/mcp",
        {"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
        _auth_headers(key["key"]),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_mcp_lists_exactly_base_19_tools(client, app) -> None:
    key = await seed_access_key(app.state.db, "mcp-list-secret", scopes=[FULL_SCOPE])
    resp = await _mcp_post(
        client,
        "/api/v1/mcp",
        {"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
        _auth_headers(key["key"]),
    )
    assert resp.status_code == 200
    payload = resp.json()
    tools = payload["result"]["tools"]
    names = {t["name"] for t in tools}
    assert len(tools) == 19
    assert names == set(MCP_TOOL_ALLOWLIST)
    assert "web.search" not in names
    assert "tasks.consult_advisor" not in names

    schema_names = {s["name"] for s in mcp_tool_schemas()}
    assert schema_names == names


@pytest.mark.asyncio
async def test_mcp_filters_list_and_call_when_capability_off(client, app) -> None:
    await set_configs(app.state.db, {"mcp_cap_calendar_write": "false"})
    key = await seed_access_key(app.state.db, "mcp-cap-secret", scopes=[FULL_SCOPE])
    headers = _auth_headers(key["key"])

    listed = await _mcp_post(
        client,
        "/api/v1/mcp",
        {"jsonrpc": "2.0", "id": 10, "method": "tools/list"},
        headers,
    )
    assert listed.status_code == 200
    names = {t["name"] for t in listed.json()["result"]["tools"]}
    assert len(names) == 19 - len(CALENDAR_WRITE_TOOL_NAMES)
    assert names.isdisjoint(CALENDAR_WRITE_TOOL_NAMES)
    assert "calendar.upcoming" in names
    assert "calendar.create_event" not in names

    denied = await _mcp_post(
        client,
        "/api/v1/mcp",
        {
            "jsonrpc": "2.0",
            "id": 11,
            "method": "tools/call",
            "params": {
                "name": "calendar.create_event",
                "arguments": {
                    "title": "Should fail",
                    "startTime": "2026-08-12T10:00:00Z",
                },
            },
        },
        headers,
    )
    assert denied.status_code == 200
    result = denied.json()["result"]
    assert result["structuredContent"]["error"] == "mcp capability disabled: calendar_write"

    allowed = await _mcp_post(
        client,
        "/api/v1/mcp",
        {
            "jsonrpc": "2.0",
            "id": 12,
            "method": "tools/call",
            "params": {"name": "calendar.upcoming", "arguments": {"days": 1}},
        },
        headers,
    )
    assert allowed.status_code == 200
    assert allowed.json()["result"].get("isError") is False


@pytest.mark.asyncio
async def test_mcp_read_and_write_calendar_origin_mcp(client, app) -> None:
    key = await seed_access_key(app.state.db, "mcp-rw-secret", scopes=[FULL_SCOPE])
    headers = _auth_headers(key["key"])

    upcoming = await _mcp_post(
        client,
        "/api/v1/mcp",
        {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {"name": "calendar.upcoming", "arguments": {"days": 1}},
        },
        headers,
    )
    assert upcoming.status_code == 200
    up_body = upcoming.json()["result"]
    assert up_body.get("isError") is False
    assert "structuredContent" in up_body

    created = await _mcp_post(
        client,
        "/api/v1/mcp",
        {
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": "calendar.create_event",
                "arguments": {
                    "title": "MCP created meeting",
                    "startTime": "2026-08-12T10:00:00Z",
                    "endTime": "2026-08-12T11:00:00Z",
                },
            },
        },
        headers,
    )
    assert created.status_code == 200
    create_result = created.json()["result"]
    assert create_result.get("isError") is False
    item = create_result["structuredContent"]["item"]
    assert item["origin"] == "mcp"
    assert item["title"] == "MCP created meeting"


@pytest.mark.asyncio
async def test_mcp_rejects_non_allowlist_tool(client, app) -> None:
    key = await seed_access_key(app.state.db, "mcp-deny-secret", scopes=[FULL_SCOPE])
    resp = await _mcp_post(
        client,
        "/api/v1/mcp",
        {
            "jsonrpc": "2.0",
            "id": 4,
            "method": "tools/call",
            "params": {"name": "web.search", "arguments": {"query": "x"}},
        },
        _auth_headers(key["key"]),
    )
    assert resp.status_code == 200
    result = resp.json()["result"]
    assert result.get("isError") is False
    assert result["structuredContent"]["error"] == "tool not allowed: web.search"


@pytest.mark.asyncio
async def test_execute_mcp_tool_facade_sets_origin(app) -> None:
    """Direct façade path (same allowlist / origin as HTTP)."""
    created = await execute_mcp_tool(
        app.state.db,
        "calendar.create_event",
        {
            "title": "Facade MCP event",
            "startTime": "2026-08-13T09:00:00Z",
        },
        broadcaster=app.state.broadcaster,
    )
    assert "error" not in created
    assert created["item"]["origin"] == "mcp"

    denied = await execute_mcp_tool(app.state.db, "tasks.consult_advisor", {"question": "hi"})
    assert denied["error"] == "tool not allowed: tasks.consult_advisor"


@pytest.mark.asyncio
async def test_mcp_master_switch_off_rejects_http(client, app) -> None:
    await set_configs(app.state.db, {"mcp_enabled": "false"})
    key = await seed_access_key(app.state.db, "mcp-off-secret", scopes=[FULL_SCOPE])
    resp = await _mcp_post(
        client,
        "/api/v1/mcp",
        {"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
        _auth_headers(key["key"]),
    )
    assert resp.status_code == 403
    body = resp.json()
    assert body["error_code"] == "FORBIDDEN"
    assert "mcp_enabled" in body["message"]


@pytest.mark.asyncio
async def test_mcp_status_lists_filtered_tools(client, app) -> None:
    await set_configs(app.state.db, {"mcp_cap_calendar_write": "false"})
    resp = await client.get("/api/v1/mcp/status")
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["enabled"] is True
    names = {t["name"] for t in payload["tools"]}
    assert payload["toolCount"] == len(names)
    assert names.isdisjoint(CALENDAR_WRITE_TOOL_NAMES)
    assert "calendar.upcoming" in names
    assert payload["toolCount"] == 19 - len(CALENDAR_WRITE_TOOL_NAMES)


@pytest.mark.asyncio
async def test_mcp_status_when_master_off(client, app) -> None:
    await set_configs(app.state.db, {"mcp_enabled": "false"})
    resp = await client.get("/api/v1/mcp/status")
    assert resp.status_code == 200
    payload = resp.json()
    assert payload["enabled"] is False
    assert payload["toolCount"] == 0
    assert payload["tools"] == []


@pytest.mark.asyncio
async def test_mcp_delete_requires_confirm(app) -> None:
    created = await execute_mcp_tool(
        app.state.db,
        "calendar.create_event",
        {
            "title": "Delete confirm guard",
            "startTime": "2026-08-14T10:00:00Z",
        },
        broadcaster=app.state.broadcaster,
    )
    event_id = created["item"]["id"]

    rejected = await execute_mcp_tool(
        app.state.db,
        "calendar.delete_event",
        {"id": event_id},
        broadcaster=app.state.broadcaster,
    )
    assert rejected["error"] == MCP_CONFIRM_REQUIRED_ERROR

    rejected_false = await execute_mcp_tool(
        app.state.db,
        "calendar.delete_event",
        {"id": event_id, "confirm": False},
        broadcaster=app.state.broadcaster,
    )
    assert rejected_false["error"] == MCP_CONFIRM_REQUIRED_ERROR

    deleted = await execute_mcp_tool(
        app.state.db,
        "calendar.delete_event",
        {"id": event_id, "confirm": True},
        broadcaster=app.state.broadcaster,
    )
    assert "error" not in deleted
    assert deleted["deleted"] is True

    schemas = {s["name"]: s for s in mcp_tool_schemas()}
    delete_schema = schemas["calendar.delete_event"]
    assert "confirm=true" in delete_schema["description"]
    assert "confirm" in delete_schema["parameters"]["required"]
    series_schema = schemas["calendar.delete_recurring_series"]
    assert "confirm" in series_schema["parameters"]["required"]


@pytest.mark.asyncio
async def test_mcp_delete_recurring_series_requires_confirm(app) -> None:
    series = await execute_mcp_tool(
        app.state.db,
        "calendar.create_recurring_series",
        {
            "name": "MCP series confirm",
            "rrule": "FREQ=DAILY;COUNT=3",
            "eventStartTime": "09:00",
        },
        broadcaster=app.state.broadcaster,
    )
    assert "error" not in series
    series_id = series["series"]["id"]

    denied = await execute_mcp_tool(
        app.state.db,
        "calendar.delete_recurring_series",
        {"id": series_id},
        broadcaster=app.state.broadcaster,
    )
    assert denied["error"] == MCP_CONFIRM_REQUIRED_ERROR

    ok = await execute_mcp_tool(
        app.state.db,
        "calendar.delete_recurring_series",
        {"id": series_id, "confirm": True},
        broadcaster=app.state.broadcaster,
    )
    assert "error" not in ok
    assert ok.get("deleted") is True

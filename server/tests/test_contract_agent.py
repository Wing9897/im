"""Contract keys: agent chat routes + NDJSON stream line schemas."""

from __future__ import annotations

import json
from typing import Any, cast, get_args
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from pydantic import BaseModel

from server.analyzer.llm_client import ConfigurableLlmClient
from server.api.agent_errors import (
    AGENT_TIMEOUT,
    AI_ENGINE_FAILED,
    AI_ENGINE_UNREACHABLE,
    agent_stream_error_event,
    agent_stream_timeout_event,
)
from server.api.schemas.responses.agents import (
    AgentStreamErrorEvent,
    AgentStreamEventType,
    AgentStreamFinalEvent,
    AgentStreamLlmStartEvent,
    AgentStreamToolDoneEvent,
    AgentStreamToolStartEvent,
)
from server.tests.contract_helpers import assert_keys

AGENT_CHAT_KEYS = ["message", "sessionId", "toolCalls"]
AGENT_TOOL_CALL_KEYS = ["name", "arguments", "resultSummary"]
AGENT_STREAM_EVENT_TYPES = ("llm_start", "tool_start", "tool_done", "final", "error")

#: One entry per emit-site variant; models use extra="forbid", so a field
#: added at an emit site without a schema update fails here.
_STREAM_LINE_PAYLOADS: tuple[tuple[str, type[BaseModel], dict[str, Any]], ...] = (
    ("llm_start", AgentStreamLlmStartEvent, {"type": "llm_start", "round": 0}),
    (
        "tool_start",
        AgentStreamToolStartEvent,
        {"type": "tool_start", "name": "calendar.upcoming", "arguments": {"limit": 5}},
    ),
    (
        "tool_done",
        AgentStreamToolDoneEvent,
        {
            "type": "tool_done",
            "name": "calendar.upcoming",
            "arguments": {"limit": 5},
            "resultSummary": "2 items",
        },
    ),
    (
        "final",
        AgentStreamFinalEvent,
        {
            "type": "final",
            "message": "接下來幾天有週會。",
            "sessionId": "s2",
            "toolCalls": [
                {
                    "name": "calendar.upcoming",
                    "arguments": {"limit": 5},
                    "resultSummary": "2 items",
                }
            ],
        },
    ),
    (
        "final",
        AgentStreamFinalEvent,
        {
            "type": "final",
            "message": "已更新",
            "sessionId": "s4",
            "toolCalls": [
                {
                    "name": "tasks.consult_advisor",
                    "arguments": {"instruction": "改名"},
                    "resultSummary": "ok",
                }
            ],
            "taskConfig": {"name": "新名稱", "promptTemplate": "分析熱門話題"},
        },
    ),
    (
        "error",
        AgentStreamErrorEvent,
        {
            "type": "error",
            "message": "Agent request timed out",
            "sessionId": "s-timeout",
            "toolCalls": [],
            "error": AGENT_TIMEOUT,
        },
    ),
    (
        "error",
        AgentStreamErrorEvent,
        {
            "type": "error",
            "message": "upstream failed",
            "sessionId": "s-fail",
            "toolCalls": [],
            "error": AI_ENGINE_FAILED,
        },
    ),
)


async def test_agent_chat_contract(client):
    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.complete = AsyncMock(
        side_effect=[
            {"text": json.dumps({"tool_calls": [{"name": "calendar.upcoming", "arguments": {"limit": 3}}]})},
            {"text": json.dumps({"message": "Upcoming events listed."})},
        ]
    )
    mock_llm.close = AsyncMock()

    with patch.object(ConfigurableLlmClient, "from_assistant_slot", AsyncMock(return_value=mock_llm)):
        resp = await client.post(
            "/api/v1/agent/chat",
            json={"messages": [{"role": "user", "content": "What's next?"}], "sessionId": "contract-s1"},
        )
    assert resp.status_code == 200
    body = resp.json()
    assert_keys(body, AGENT_CHAT_KEYS, "AgentChatResponse")
    assert body["toolCalls"], "expected at least one tool call summary"
    assert_keys(body["toolCalls"][0], AGENT_TOOL_CALL_KEYS, "AgentToolCallSummary")


async def test_agent_chat_reports_engine_failure_as_http_error(client):
    """Degraded turns must not arrive as 200 + ``error``."""
    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.complete = AsyncMock(side_effect=ConnectionError("Cannot connect to host localhost:11434"))
    mock_llm.close = AsyncMock()

    with patch.object(ConfigurableLlmClient, "from_assistant_slot", AsyncMock(return_value=mock_llm)):
        resp = await client.post(
            "/api/v1/agent/chat",
            json={"messages": [{"role": "user", "content": "hi"}], "sessionId": "contract-s3"},
        )
    assert resp.status_code == 503
    body = resp.json()
    assert body["error_code"] == "ai_engine_unreachable"
    assert "error" not in body


async def test_agent_chat_stream_final_line_contract(client):
    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.complete = AsyncMock(
        side_effect=[
            {"text": json.dumps({"tool_calls": [{"name": "calendar.upcoming", "arguments": {"limit": 2}}]})},
            {"text": json.dumps({"message": "Done."})},
        ]
    )
    mock_llm.close = AsyncMock()

    with patch.object(ConfigurableLlmClient, "from_assistant_slot", AsyncMock(return_value=mock_llm)):
        resp = await client.post(
            "/api/v1/agent/chat/stream",
            json={"messages": [{"role": "user", "content": "stream test"}], "sessionId": "contract-s2"},
        )
    assert resp.status_code == 200
    lines = [line for line in resp.text.strip().split("\n") if line.strip()]
    final = json.loads(lines[-1])
    assert final.get("type") == "final"
    assert_keys(final, AGENT_CHAT_KEYS, "AgentChatStreamFinal")
    validated = AgentStreamFinalEvent.model_validate(final)
    assert validated.model_dump(exclude_unset=True)["message"] == final["message"]


def test_stream_event_type_literal_matches_vocabulary():
    assert get_args(AgentStreamEventType) == AGENT_STREAM_EVENT_TYPES


def test_stream_error_helpers_match_schema():
    unreachable = agent_stream_error_event(
        ConnectionError("connection refused"), session_id="s1"
    )
    timeout = agent_stream_timeout_event(session_id="s2")
    AgentStreamErrorEvent.model_validate(unreachable)
    AgentStreamErrorEvent.model_validate(timeout)
    assert unreachable["error"] == AI_ENGINE_UNREACHABLE
    assert timeout["error"] == AGENT_TIMEOUT


# ── NDJSON line schema drift guards (patterned after test_contract_sse.py) ──


@pytest.mark.parametrize(
    ("event_type", "model", "payload"),
    _STREAM_LINE_PAYLOADS,
    ids=lambda value: value if isinstance(value, str) else None,
)
def test_stream_line_payloads_match_schema(event_type, model, payload):
    validated = model.model_validate(payload)
    assert validated.model_dump(exclude_unset=True) == payload
    assert validated.type == event_type


async def test_openapi_exports_agent_stream_components(app):
    schema = cast(Any, app).openapi()
    components = schema["components"]["schemas"]
    expected = {
        "AgentStreamLlmStartEvent",
        "AgentStreamToolStartEvent",
        "AgentStreamToolDoneEvent",
        "AgentStreamFinalEvent",
        "AgentStreamErrorEvent",
        "AgentStreamEvent",
    }
    missing = expected - set(components)
    assert not missing, f"OpenAPI components missing: {sorted(missing)}"

    stream_response = schema["paths"]["/api/v1/agent/chat/stream"]["post"]["responses"]["200"]
    stream_schema = stream_response["content"]["application/x-ndjson"]["schema"]
    assert stream_schema == {"$ref": "#/components/schemas/AgentStreamEvent"}
    assert components["AgentStreamEvent"]["discriminator"]["propertyName"] == "type"

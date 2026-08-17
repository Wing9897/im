"""Contract keys: agent chat routes."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

from server.analyzer.llm_client import ConfigurableLlmClient
from server.tests.contract_helpers import assert_keys

AGENT_CHAT_KEYS = ["message", "sessionId", "toolCalls"]
AGENT_TOOL_CALL_KEYS = ["name", "arguments", "resultSummary"]


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

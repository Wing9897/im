"""Regression: agent HTTP routes dump Pydantic history before the runtime.

Passing ``list[AgentChatMessage]`` into ``runtime.chat`` used to raise
``AttributeError: 'AgentChatMessage' object has no attribute 'get'`` and
surface as HTTP 502. Routes must ``model_dump()`` at the boundary.
"""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

from server.analyzer.llm_client import ConfigurableLlmClient
from server.auth.access_keys import FULL_SCOPE, seed_access_key

MULTI_TURN_HISTORY = [
    {"role": "user", "content": "earlier question"},
    {"role": "assistant", "content": "previous answer"},
    {"role": "user", "content": "follow up"},
]


def _mock_llm() -> MagicMock:
    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.complete = AsyncMock(return_value={"text": json.dumps({"message": "ok"})})
    mock_llm.close = AsyncMock()
    mock_llm.provider = "ollama"
    return mock_llm


def _assert_history_dicts(sent: list[object]) -> None:
    """Runtime must receive plain dicts (``.get``), not Pydantic models."""
    user_or_assistant = [m for m in sent if isinstance(m, dict) and m.get("role") in {"user", "assistant"}]
    assert all(isinstance(m, dict) for m in sent)
    assert {m["content"] for m in user_or_assistant} >= {"earlier question", "previous answer", "follow up"}
    # The original failure was message.get("role") on a BaseModel.
    assert all(m.get("role") for m in user_or_assistant)


async def test_agent_chat_dumps_multi_turn_history_before_runtime(client) -> None:
    mock_llm = _mock_llm()
    with patch.object(ConfigurableLlmClient, "from_assistant_slot", AsyncMock(return_value=mock_llm)):
        resp = await client.post(
            "/api/v1/agent/chat",
            json={"messages": MULTI_TURN_HISTORY, "sessionId": "hist-assistant-1"},
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "error" not in body
    assert body["message"]
    sent = mock_llm.complete.await_args_list[0].args[0]
    _assert_history_dicts(sent)
    mock_llm.close.assert_awaited()


async def test_a2a_agent_dumps_caller_held_history_before_runtime(client, app) -> None:
    key = await seed_access_key(app.state.db, "a2a-history-secret", scopes=[FULL_SCOPE])
    mock_llm = _mock_llm()
    with patch.object(ConfigurableLlmClient, "from_liaison_slot", AsyncMock(return_value=mock_llm)):
        resp = await client.post(
            "/api/v1/a2a/agent",
            json={
                "messages": MULTI_TURN_HISTORY[:2],
                "input": "follow up",
            },
            headers={"Authorization": f"Bearer {key['key']}"},
        )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "error" not in body
    assert body["message"]
    sent = mock_llm.complete.await_args_list[0].args[0]
    _assert_history_dicts(sent)
    mock_llm.close.assert_awaited()

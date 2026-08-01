"""A2A LLM agent channel: auth + single-shot response (no session store)."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from server.auth.access_keys import DEFAULT_SCOPES, FULL_SCOPE, READ_SCOPE, seed_access_key
from server.agent.runtime import AgentRuntime
from server.analyzer.llm_client import ConfigurableLlmClient
from server.auth.device_auth import create_device_session


async def _auth_headers(secret: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {secret}"}


@pytest.mark.asyncio
async def test_a2a_agent_rejects_missing_and_device_session(client, app) -> None:
    missing = await client.post("/api/v1/a2a/agent", json={"input": "hi"})
    assert missing.status_code == 403

    tokens = await create_device_session(app.state.db, label="UI")
    device = await client.post(
        "/api/v1/a2a/agent",
        json={"input": "hi"},
        headers=await _auth_headers(tokens["accessToken"]),
    )
    assert device.status_code == 403


@pytest.mark.asyncio
async def test_a2a_agent_rejects_read_only_key(client, app) -> None:
    key = await seed_access_key(app.state.db, "a2a-read-secret", scopes=[READ_SCOPE])
    resp = await client.post(
        "/api/v1/a2a/agent",
        json={"input": "hi"},
        headers=await _auth_headers(key["key"]),
    )
    assert resp.status_code == 403


@pytest.mark.asyncio
async def test_a2a_agent_accepts_full_scope_and_returns_single_shot(client, app) -> None:
    key = await seed_access_key(app.state.db, "a2a-agent-secret", scopes=[FULL_SCOPE])
    headers = await _auth_headers(key["key"])

    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.complete = AsyncMock(
        side_effect=[
            {
                "text": json.dumps(
                    {
                        "tool_calls": [
                            {
                                "name": "calendar.upcoming",
                                "arguments": {"days": 1},
                            }
                        ]
                    }
                )
            },
            {"text": json.dumps({"message": "明天没有会议。"})},
        ]
    )
    mock_llm.close = AsyncMock()
    mock_llm.provider = "ollama"

    with patch.object(ConfigurableLlmClient, "from_db_for_agent", AsyncMock(return_value=mock_llm)):
        resp = await client.post(
            "/api/v1/a2a/agent",
            json={"input": "明天有什麼會議？"},
            headers=headers,
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["message"] == "明天没有会议。"
    assert body.get("sessionId") is None
    assert isinstance(body.get("toolCalls"), list)
    assert any(t.get("name") == "calendar.upcoming" for t in body["toolCalls"])
    system = mock_llm.complete.await_args_list[0].args[0][0]["content"]
    assert "客戶經理" in system or "对外" in system


@pytest.mark.asyncio
async def test_a2a_agent_accepts_caller_held_history_for_request(app) -> None:
    """No server session — but third-party may pass prior turns for this call only."""
    db = app.state.db
    mock_llm = MagicMock(spec=ConfigurableLlmClient)
    mock_llm.complete = AsyncMock(return_value={"text": json.dumps({"message": "ok"})})
    mock_llm.close = AsyncMock()
    mock_llm.provider = "ollama"

    runtime = AgentRuntime(db, mock_llm)
    await runtime.chat(
        [
            {"role": "user", "content": "earlier"},
            {"role": "assistant", "content": "prev reply"},
            {"role": "user", "content": "follow up"},
        ],
        channel="a2a",
    )
    sent = mock_llm.complete.await_args_list[0].args[0]
    user_msgs = [m for m in sent if m["role"] == "user"]
    assert len(user_msgs) == 2
    assert user_msgs[-1]["content"] == "follow up"


@pytest.mark.asyncio
async def test_default_scopes_are_full() -> None:
    assert DEFAULT_SCOPES == [FULL_SCOPE]

"""Unit tests for agent completion fallbacks in ``runtime_complete``."""

from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from server.agent.runtime_complete import (
    _agent_complete_attempts,
    complete_for_agent,
)


def test_agent_complete_attempts_gemini_native_then_plain() -> None:
    assert _agent_complete_attempts(prefer_json_mode=False, native_web_search="gemini") == [
        (False, "gemini"),
        (False, None),
    ]


def test_agent_complete_attempts_json_mode_chain() -> None:
    assert _agent_complete_attempts(prefer_json_mode=True, native_web_search="openai") == [
        (True, "openai"),
        (True, None),
        (False, None),
    ]


@pytest.mark.asyncio
async def test_complete_for_agent_falls_back_when_native_web_search_fails(app) -> None:
    db = app.state.db
    llm = MagicMock()
    llm.complete = AsyncMock(return_value={"text": '{"message":"ok"}'})
    llm.provider = "gemini"
    llm.profile_id = ""

    with patch(
        "server.web_search.execution.WebSearchExecutionService.native_complete",
        new_callable=AsyncMock,
        side_effect=RuntimeError("hosted search unavailable"),
    ) as native_complete:
        result = await complete_for_agent(
            db,
            llm,
            [{"role": "user", "content": "hi"}],
            native_web_search="gemini",
        )

    assert result["text"] == '{"message":"ok"}'
    native_complete.assert_awaited_once()
    llm.complete.assert_awaited_once()


@pytest.mark.asyncio
async def test_complete_for_agent_still_falls_back_from_json_mode(app) -> None:
    db = app.state.db
    llm = MagicMock()
    llm.complete = AsyncMock(side_effect=[RuntimeError("json mode rejected"), {"text": '{"message":"ok"}'}])
    llm.provider = "openai"
    llm.profile_id = ""

    with patch(
        "server.agent.runtime_complete.prefer_json_mode",
        new_callable=AsyncMock,
        return_value=True,
    ):
        result = await complete_for_agent(
            db,
            llm,
            [{"role": "user", "content": "hi"}],
            native_web_search=None,
        )

    assert result["text"] == '{"message":"ok"}'
    assert llm.complete.await_count == 2

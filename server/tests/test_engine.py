"""Unit tests for server.analyzer.engine helpers."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from server.analyzer.engine import AnalysisEngine
from server.analyzer.llm_client import ConfigurableLlmClient
from server.analyzer.prompt import AssembledPrompt
from server.db.schema_domains.llm import DEFAULT_LLM_PROFILE_ID
from server.prompts.assistant import TASK_CONFIG_SCHEMA_PROMPT
from server.util import utc_now_iso


def test_task_config_schema_prompt_lists_required_fields() -> None:
    assert "name:" in TASK_CONFIG_SCHEMA_PROMPT
    assert "promptTemplate:" in TASK_CONFIG_SCHEMA_PROMPT
    assert "analysisMode:" in TASK_CONFIG_SCHEMA_PROMPT
    assert "includeInTimeline:" in TASK_CONFIG_SCHEMA_PROMPT


@pytest.mark.parametrize(
    ("response_text", "expected"),
    [
        (
            'Sure.\n```json\n{"taskConfig": {"name": "A", "promptTemplate": "go"}}\n```',
            {"name": "A", "promptTemplate": "go"},
        ),
        (
            '{"name": "Flat task", "promptTemplate": "analyze messages"}',
            {"name": "Flat task", "promptTemplate": "analyze messages"},
        ),
        (
            'Note: {"name": "Embedded", "promptTemplate": "go"} end',
            {"name": "Embedded", "promptTemplate": "go"},
        ),
        (
            '<think>planning</think>\n{"name": "After think", "promptTemplate": "go"}',
            {"name": "After think", "promptTemplate": "go"},
        ),
        (
            "Just chatting, no configuration here.",
            None,
        ),
        (
            '```json\n{"taskConfig": "not-a-dict"}\n```',
            None,
        ),
    ],
)
def test_extract_task_config_parses_supported_shapes(
    response_text: str,
    expected: dict | None,
) -> None:
    assert AnalysisEngine._extract_task_config(response_text) == expected


async def test_json_mode_for_analyze_honors_profile_json_mode(app) -> None:
    db = app.state.db
    engine = AnalysisEngine(db)
    mock_client = MagicMock(spec=ConfigurableLlmClient)
    mock_client.provider = "openai"

    # Stored vocabulary is CHECK-constrained: disabled / json_schema /
    # json_object. Legacy sentinel collapse ("off" / "0" / …) stays unit-tested
    # against is_openai_json_mode_enabled in test_util.py.
    await db.execute(
        "UPDATE llm_profiles SET json_mode = 'disabled', updated_at = ? WHERE id = ?",
        (utc_now_iso(), DEFAULT_LLM_PROFILE_ID),
    )
    assert await engine._json_mode_for_analyze(mock_client, DEFAULT_LLM_PROFILE_ID) is False

    for value in ("json_schema", "json_object"):
        await db.execute(
            "UPDATE llm_profiles SET json_mode = ?, updated_at = ? WHERE id = ?",
            (value, utc_now_iso(), DEFAULT_LLM_PROFILE_ID),
        )
        assert await engine._json_mode_for_analyze(mock_client, DEFAULT_LLM_PROFILE_ID) is True

    mock_client.provider = "ollama"
    assert await engine._json_mode_for_analyze(mock_client, DEFAULT_LLM_PROFILE_ID) is True


async def test_engine_provider_and_model_are_empty_before_first_use(app) -> None:
    engine = AnalysisEngine(app.state.db)
    assert engine.provider == ""
    assert engine.model == ""


async def test_concurrent_first_use_creates_one_llm_client(app) -> None:
    engine = AnalysisEngine(app.state.db)
    mock_client = MagicMock(spec=ConfigurableLlmClient)
    mock_client.close = AsyncMock()

    async def create_client(_db, _profile_id):
        await asyncio.sleep(0)
        return mock_client

    with (
        patch.object(
            AnalysisEngine,
            "_config_hash_for_profile",
            AsyncMock(return_value=(DEFAULT_LLM_PROFILE_ID, "same-config")),
        ),
        patch.object(ConfigurableLlmClient, "from_profile", AsyncMock(side_effect=create_client)) as from_profile,
    ):
        clients = await asyncio.gather(*(engine._ensure_client(None) for _ in range(3)))

    assert clients == [mock_client, mock_client, mock_client]
    from_profile.assert_awaited_once_with(app.state.db, DEFAULT_LLM_PROFILE_ID)


async def test_analyze_parses_llm_json_and_returns_token_counts(app) -> None:
    db = app.state.db

    mock_client = MagicMock(spec=ConfigurableLlmClient)
    mock_client.complete = AsyncMock(
        return_value={
            "text": '{"items": [{"title": "Intel", "content": "Body"}]}',
            "prompt_tokens": 12,
            "completion_tokens": 7,
        },
    )
    mock_client.provider = "ollama"
    mock_client.model = "test-model"
    mock_client.close = AsyncMock()

    engine = AnalysisEngine(db)
    prompt = AssembledPrompt(
        llm_messages=[{"role": "user", "content": "analyze"}],
        system_prompt="system",
        user_content="user",
        analysis_mode="intel_event",
        estimated_tokens=4,
        overlap_used_count=0,
        overlap_trimmed_count=0,
        primary_used_count=1,
        overlap_tokens=0,
        primary_tokens=4,
    )

    with patch.object(ConfigurableLlmClient, "from_profile", AsyncMock(return_value=mock_client)):
        result = await engine.analyze(prompt)

    assert result["items"] == [{"title": "Intel", "content": "Body"}]
    assert result["prompt_tokens"] == 12
    assert result["completion_tokens"] == 7
    mock_client.complete.assert_awaited_once_with(
        prompt.llm_messages,
        json_mode=True,
    )


async def test_consult_task_advisor_extracts_task_config_from_llm_reply(app) -> None:
    db = app.state.db

    response_text = (
        'Here is a suggested setup.\n```json\n{"taskConfig": {"name": "Alerts", "promptTemplate": "watch quakes"}}\n```'
    )
    mock_client = MagicMock(spec=ConfigurableLlmClient)
    mock_client.complete = AsyncMock(return_value={"text": response_text})
    mock_client.provider = "ollama"
    mock_client.model = "chat-model"
    mock_client.close = AsyncMock()

    engine = AnalysisEngine(db)

    with patch.object(ConfigurableLlmClient, "from_profile", AsyncMock(return_value=mock_client)):
        result = await engine.consult_task_advisor("monitor earthquakes")

    assert result["message"] == response_text
    assert result["taskConfig"] == {"name": "Alerts", "promptTemplate": "watch quakes"}

    messages = mock_client.complete.await_args.args[0]
    assert messages[0]["role"] == "system"
    assert "taskConfig" in messages[0]["content"]
    assert "channelIds" in messages[0]["content"]
    assert "Traditional Chinese" in messages[0]["content"]
    assert messages[1] == {"role": "user", "content": "monitor earthquakes"}


async def test_consult_task_advisor_appends_english_locale_directive(app) -> None:
    db = app.state.db

    mock_client = MagicMock(spec=ConfigurableLlmClient)
    mock_client.complete = AsyncMock(return_value={"text": "Sure."})
    mock_client.close = AsyncMock()

    engine = AnalysisEngine(db)

    with patch.object(ConfigurableLlmClient, "from_profile", AsyncMock(return_value=mock_client)):
        await engine.consult_task_advisor("hello", locale="en")

    system = mock_client.complete.await_args.args[0][0]["content"]
    assert "Write all user-facing text in English." in system
    assert "Traditional Chinese" not in system


async def test_consult_task_advisor_includes_current_task_draft_without_channels(app) -> None:
    db = app.state.db

    mock_client = MagicMock(spec=ConfigurableLlmClient)
    mock_client.complete = AsyncMock(return_value={"text": "Updated the prompt."})
    mock_client.close = AsyncMock()

    engine = AnalysisEngine(db)
    draft = {
        "name": "地震監控",
        "promptTemplate": "找地震相關訊息",
        "analysisMode": "intel_event",
        "channelIds": ["should-not-appear"],
        "description": "",
    }

    with patch.object(ConfigurableLlmClient, "from_profile", AsyncMock(return_value=mock_client)):
        await engine.consult_task_advisor("把提示詞寫清楚一點", current_task=draft)

    user_content = mock_client.complete.await_args.args[0][1]["content"]
    assert "地震監控" in user_content
    assert "找地震相關訊息" in user_content
    assert "User message:" in user_content
    assert "把提示詞寫清楚一點" in user_content
    assert "should-not-appear" not in user_content
    assert "channelIds" not in user_content


async def test_consult_task_advisor_returns_null_task_config_for_plain_chat(app) -> None:
    db = app.state.db

    mock_client = MagicMock(spec=ConfigurableLlmClient)
    mock_client.complete = AsyncMock(return_value={"text": "Sure, ask me anything about tasks."})
    mock_client.close = AsyncMock()

    engine = AnalysisEngine(db)

    with patch.object(ConfigurableLlmClient, "from_profile", AsyncMock(return_value=mock_client)):
        result = await engine.consult_task_advisor("hello")

    assert result["taskConfig"] is None
    assert "ask me anything" in result["message"]

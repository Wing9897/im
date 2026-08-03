"""Unit tests for LLM config resolution and JSON reply parsing."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from server.analyzer.llm_client import ConfigurableLlmClient, load_agent_llm_config, load_llm_config
from server.analyzer.llm_json import extract_json_from_markdown, normalize_items, parse_json_response
from server.analyzer.llm_providers import LlmClientError
from server.config import set_configs


def test_extract_json_from_markdown_reads_fenced_block() -> None:
    text = 'Here is the result:\n```json\n{"items": [{"id": 1}]}\n```\nThanks.'
    assert extract_json_from_markdown(text) == '{"items": [{"id": 1}]}'


def test_parse_json_response_accepts_plain_json() -> None:
    parsed = parse_json_response('{"topic": "alpha", "score": 9}')
    assert parsed == {"topic": "alpha", "score": 9}


def test_parse_json_response_accepts_markdown_wrapped_json() -> None:
    parsed = parse_json_response('Analysis complete.\n```json\n{"items": [{"title": "A"}]}\n```')
    assert parsed == {"items": [{"title": "A"}]}


def test_parse_json_response_accepts_prose_with_embedded_object() -> None:
    parsed = parse_json_response('Note: {"name": "task", "promptTemplate": "go"} end')
    assert parsed == {"name": "task", "promptTemplate": "go"}


def test_parse_json_response_raises_on_invalid_payload() -> None:
    with pytest.raises(ValueError, match="Failed to parse LLM response as JSON"):
        parse_json_response("not json at all")


def test_normalize_items_from_dict_with_items_key() -> None:
    assert normalize_items({"items": [{"id": "1"}, {"id": "2"}]}) == [{"id": "1"}, {"id": "2"}]


def test_normalize_items_from_list_and_singleton() -> None:
    assert normalize_items([{"id": "1"}]) == [{"id": "1"}]
    assert normalize_items({"id": "solo"}) == [{"id": "solo"}]


async def test_load_llm_config_resolves_provider_aliases(app) -> None:
    db = app.state.db
    await set_configs(
        db,
        {
            "llm_provider": "gemini_compatible",
            "gemini_model": "gemini-test",
            "gemini_api_key": "secret",
            "gemini_base_url": "https://example.test/v1beta",
        },
    )

    config = await load_llm_config(db)

    assert config["provider"] == "gemini"
    assert config["provider_raw"] == "gemini_compatible"
    assert config["model"] == "gemini-test"
    assert config["api_key"] == "secret"
    assert config["base_url"] == "https://example.test/v1beta"


async def _seed_global_and_openai(db) -> None:
    await set_configs(
        db,
        {
            "llm_provider": "ollama",
            "ollama_model": "llama-global",
            "ollama_base_url": "http://localhost:11434",
            "openai_model": "gpt-agent-override",
            "openai_api_key": "openai-secret",
            "openai_base_url": "https://api.openai.com/v1",
        },
    )


@pytest.mark.parametrize(
    "assistant_provider",
    ["", "follow", "FOLLOW", "not-a-provider"],
)
async def test_load_agent_llm_config_follows_global(app, assistant_provider: str) -> None:
    db = app.state.db
    await _seed_global_and_openai(db)
    await set_configs(db, {"assistant_llm_provider": assistant_provider})

    config = await load_agent_llm_config(db)

    assert config["provider"] == "ollama"
    assert config["provider_raw"] == "ollama"
    assert config["model"] == "llama-global"
    assert config["base_url"] == "http://localhost:11434"


async def test_load_agent_llm_config_override_empty_fields_fall_back_to_provider_prefix(
    app,
) -> None:
    """Empty assistant_llm_* fields reuse the override provider's global {prefix}_* keys."""
    db = app.state.db
    await _seed_global_and_openai(db)
    await set_configs(
        db,
        {
            "assistant_llm_provider": "openai",
            "assistant_llm_base_url": "",
            "assistant_llm_model": "",
            "assistant_llm_api_key": "",
        },
    )

    config = await load_agent_llm_config(db)

    assert config["provider"] == "openai"
    assert config["provider_raw"] == "openai"
    assert config["model"] == "gpt-agent-override"
    assert config["api_key"] == "openai-secret"
    assert config["base_url"] == "https://api.openai.com/v1"


async def test_load_agent_llm_config_override_uses_assistant_specific_fields(app) -> None:
    db = app.state.db
    await _seed_global_and_openai(db)
    await set_configs(
        db,
        {
            "assistant_llm_provider": "openai",
            "assistant_llm_base_url": "https://assistant.example/v1",
            "assistant_llm_model": "gpt-assistant-only",
            "assistant_llm_api_key": "assistant-secret",
        },
    )

    config = await load_agent_llm_config(db)

    assert config["provider"] == "openai"
    assert config["provider_raw"] == "openai"
    assert config["model"] == "gpt-assistant-only"
    assert config["api_key"] == "assistant-secret"
    assert config["base_url"] == "https://assistant.example/v1"


async def test_load_agent_llm_config_override_partial_fields_mix_with_prefix(app) -> None:
    """Only non-empty assistant fields override; the rest stay on provider prefix."""
    db = app.state.db
    await _seed_global_and_openai(db)
    await set_configs(
        db,
        {
            "assistant_llm_provider": "openai",
            "assistant_llm_model": "gpt-assistant-only",
            "assistant_llm_base_url": "",
            "assistant_llm_api_key": "",
        },
    )

    config = await load_agent_llm_config(db)

    assert config["provider"] == "openai"
    assert config["model"] == "gpt-assistant-only"
    assert config["api_key"] == "openai-secret"
    assert config["base_url"] == "https://api.openai.com/v1"


async def test_load_agent_llm_config_override_accepts_alias(app) -> None:
    db = app.state.db
    await _seed_global_and_openai(db)
    await set_configs(db, {"assistant_llm_provider": "openai_compatible"})

    config = await load_agent_llm_config(db)

    assert config["provider"] == "openai"
    assert config["provider_raw"] == "openai_compatible"
    assert config["model"] == "gpt-agent-override"
    assert config["api_key"] == "openai-secret"


async def test_complete_attaches_provider_on_http_error() -> None:
    client = ConfigurableLlmClient(
        provider="openai",
        model="gpt-test",
        api_key="sk-test",
        base_url="https://api.openai.com/v1",
        timeout_seconds=5,
        allow_loopback=False,
    )

    async def _boom(*_args: Any, **_kwargs: Any) -> dict:
        raise LlmClientError(
            "LLM request failed with status 429: rate limited",
            status_code=429,
            response_body="rate limited",
        )

    handlers = dict(ConfigurableLlmClient._COMPLETE_HANDLERS)
    handlers["openai_style"] = _boom
    with (
        patch("server.analyzer.llm_client.validate_outbound_url", new=AsyncMock()),
        patch.object(ConfigurableLlmClient, "_COMPLETE_HANDLERS", handlers),
    ):
        with pytest.raises(LlmClientError) as caught:
            await client.complete([{"role": "user", "content": "ping"}])

    assert caught.value.provider == "openai"
    assert caught.value.status_code == 429
    await client.close()

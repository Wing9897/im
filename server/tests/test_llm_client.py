"""Unit tests for LLM config resolution and JSON reply parsing."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from server.analyzer.llm_client import ConfigurableLlmClient, load_agent_llm_config, load_llm_config
from server.analyzer.llm_config import (
    DEFAULT_PROVIDER_BASE_URLS,
    config_from_draft_fields,
    load_llm_config_for_profile,
)
from server.analyzer.llm_json import extract_json_from_markdown, normalize_items, parse_json_response
from server.analyzer.llm_providers import LlmClientError
from server.llm_profiles_const import DEFAULT_LLM_PROFILE_ID
from server.secrets import protect_text
from server.util import utc_now_iso


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


async def _update_default_profile(
    db,
    *,
    provider: str,
    model: str = "",
    api_key: str = "",
    base_url: str = "",
) -> None:
    await db.execute(
        "UPDATE llm_profiles SET provider = ?, model = ?, api_key = ?, base_url = ?, updated_at = ? "
        "WHERE id = ?",
        (
            provider,
            model,
            protect_text(api_key) if api_key else "",
            base_url,
            utc_now_iso(),
            DEFAULT_LLM_PROFILE_ID,
        ),
    )


async def test_load_llm_config_uses_default_profile(app) -> None:
    db = app.state.db
    await _update_default_profile(
        db,
        provider="ollama",
        model="llama-default",
        base_url="http://localhost:11434",
    )

    config = await load_llm_config(db)

    assert config["provider"] == "ollama"
    assert config["provider_raw"] == "ollama"
    assert config["model"] == "llama-default"
    assert config["base_url"] == "http://localhost:11434"
    assert config["profile_id"] == DEFAULT_LLM_PROFILE_ID


async def test_load_llm_config_resolves_provider_aliases(app) -> None:
    db = app.state.db
    await _update_default_profile(
        db,
        provider="gemini_compatible",
        model="gemini-test",
        api_key="secret",
        base_url="https://example.test/v1beta",
    )

    config = await load_llm_config(db)

    assert config["provider"] == "gemini"
    assert config["provider_raw"] == "gemini_compatible"
    assert config["model"] == "gemini-test"
    assert config["api_key"] == "secret"
    assert config["base_url"] == "https://example.test/v1beta"


async def test_load_agent_llm_config_follows_default_assistant_staff(app) -> None:
    db = app.state.db
    await _update_default_profile(
        db,
        provider="ollama",
        model="llama-agent",
        base_url="http://localhost:11434",
    )

    config = await load_agent_llm_config(db)

    assert config["provider"] == "ollama"
    assert config["model"] == "llama-agent"
    assert config["profile_id"] == DEFAULT_LLM_PROFILE_ID


async def test_load_agent_llm_config_follows_assistant_on_non_default_profile(app) -> None:
    """Assistant staff may live on a non-default profile — resolve by staff_class."""
    db = app.state.db
    now = utc_now_iso()
    profile_id = "profile-assistant-elsewhere"
    await db.execute(
        "INSERT INTO llm_profiles ("
        "id, name, provider, base_url, model, api_key, thinking_enabled, json_mode, "
        "web_search_enabled, web_search_provider, brave_search_api_key, is_default, "
        "created_at, updated_at"
        ") VALUES (?, ?, ?, ?, ?, ?, 0, 'disabled', 1, 'auto', '', 0, ?, ?)",
        (
            profile_id,
            "Assistant elsewhere",
            "openai_compatible",
            "https://api.openai.com/v1",
            "gpt-assistant",
            protect_text("assistant-secret"),
            now,
            now,
        ),
    )
    # Move the sole active assistant staff instance off the default profile.
    await db.execute(
        "UPDATE llm_staff_instances SET profile_id = ?, updated_at = ? "
        "WHERE staff_class = 'assistant'",
        (profile_id, now),
    )
    await _update_default_profile(
        db,
        provider="ollama",
        model="should-not-use",
        base_url="http://localhost:11434",
    )

    config = await load_agent_llm_config(db)

    assert config["provider"] == "openai"
    assert config["model"] == "gpt-assistant"
    assert config["api_key"] == "assistant-secret"
    assert config["profile_id"] == profile_id


async def test_load_agent_llm_config_honors_profile_id_override(app) -> None:
    """Per-session override skips staff_class=assistant and loads that profile."""
    db = app.state.db
    now = utc_now_iso()
    override_id = "profile-session-override"
    await db.execute(
        "INSERT INTO llm_profiles ("
        "id, name, provider, base_url, model, api_key, thinking_enabled, json_mode, "
        "web_search_enabled, web_search_provider, brave_search_api_key, is_default, "
        "created_at, updated_at"
        ") VALUES (?, ?, ?, ?, ?, ?, 0, 'disabled', 1, 'auto', '', 0, ?, ?)",
        (
            override_id,
            "Session override",
            "openrouter",
            "https://openrouter.ai/api/v1",
            "openrouter/auto",
            protect_text("or-secret"),
            now,
            now,
        ),
    )
    await _update_default_profile(
        db,
        provider="ollama",
        model="staff-llama",
        base_url="http://localhost:11434",
    )

    config = await load_agent_llm_config(db, profile_id=override_id)

    assert config["provider"] == "openrouter"
    assert config["model"] == "openrouter/auto"
    assert config["api_key"] == "or-secret"
    assert config["profile_id"] == override_id

    staff_config = await load_agent_llm_config(db)
    assert staff_config["model"] == "staff-llama"
    assert staff_config["profile_id"] == DEFAULT_LLM_PROFILE_ID


async def test_load_llm_config_for_profile_reads_dedicated_row(app) -> None:
    db = app.state.db
    now = utc_now_iso()
    profile_id = "profile-openai-test"
    await db.execute(
        "INSERT INTO llm_profiles ("
        "id, name, provider, base_url, model, api_key, thinking_enabled, json_mode, "
        "web_search_enabled, web_search_provider, brave_search_api_key, is_default, "
        "created_at, updated_at"
        ") VALUES (?, ?, ?, ?, ?, ?, 0, 'disabled', 1, 'auto', '', 0, ?, ?)",
        (
            profile_id,
            "OpenAI test",
            "openai_compatible",
            "https://api.openai.com/v1",
            "gpt-test",
            protect_text("openai-secret"),
            now,
            now,
        ),
    )

    config = await load_llm_config_for_profile(db, profile_id)

    assert config["provider"] == "openai"
    assert config["provider_raw"] == "openai_compatible"
    assert config["model"] == "gpt-test"
    assert config["api_key"] == "openai-secret"
    assert config["profile_id"] == profile_id


def test_config_from_draft_fields_merges_over_fallback() -> None:
    fallback = {
        "provider": "ollama",
        "provider_raw": "ollama",
        "model": "llama-fallback",
        "api_key": "keep-me",
        "base_url": "http://localhost:11434",
        "ollama_thinking_enabled": False,
        "json_mode": "disabled",
        "web_search_enabled": True,
        "web_search_provider": "auto",
        "brave_search_api_key": "",
        "profile_id": DEFAULT_LLM_PROFILE_ID,
    }
    config = config_from_draft_fields(
        {
            "provider": "openai_compatible",
            "model": "gpt-draft",
            "baseUrl": "https://api.openai.com/v1",
            "apiKey": "draft-secret",
        },
        fallback=fallback,  # type: ignore[arg-type]
    )
    assert config["provider"] == "openai"
    assert config["provider_raw"] == "openai_compatible"
    assert config["model"] == "gpt-draft"
    assert config["api_key"] == "draft-secret"
    assert config["base_url"] == "https://api.openai.com/v1"


async def test_client_from_draft_uses_draft_fields(app) -> None:
    client = await ConfigurableLlmClient.from_draft(
        app.state.db,
        {
            "provider": "gemini_compatible",
            "model": "gemini-draft",
            "baseUrl": "https://example.test/v1beta",
            "apiKey": "draft-key",
        },
    )
    try:
        assert client.provider == "gemini"
        assert client.model == "gemini-draft"
        assert client.api_key == "draft-key"
        assert client.base_url == "https://example.test/v1beta"
    finally:
        await client.close()


def test_gemini_default_base_url_matches_profile_fallback() -> None:
    assert DEFAULT_PROVIDER_BASE_URLS["gemini"] == "https://generativelanguage.googleapis.com/v1beta"


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

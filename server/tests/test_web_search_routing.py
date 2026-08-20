"""Assistant web-search route resolution (auto / native / tool)."""

from __future__ import annotations

import pytest

from server.agent.web_search_routing import (
    is_official_gemini_base,
    is_official_openai_base,
    resolve_web_search_route,
)


def test_official_host_helpers() -> None:
    assert is_official_openai_base("https://api.openai.com/v1")
    assert not is_official_openai_base("https://openrouter.ai/api/v1")
    assert is_official_gemini_base("https://generativelanguage.googleapis.com/v1beta")
    assert not is_official_gemini_base("http://localhost:8080")


def test_disabled_never_injects_or_natives() -> None:
    route = resolve_web_search_route(
        web_search_enabled=False,
        web_search_provider="auto",
        llm_provider="openai",
        llm_base_url="https://api.openai.com/v1",
    )
    assert route.mode == "off"
    assert route.inject_web_search_tool is False
    assert route.native_web_search is None


def test_auto_openai_official_uses_native() -> None:
    route = resolve_web_search_route(
        web_search_enabled=True,
        web_search_provider="auto",
        llm_provider="openai",
        llm_base_url="https://api.openai.com/v1",
    )
    assert route.mode == "openai_native"
    assert route.inject_web_search_tool is False
    assert route.native_web_search == "openai"


def test_auto_gemini_official_uses_native() -> None:
    route = resolve_web_search_route(
        web_search_enabled=True,
        web_search_provider="auto",
        llm_provider="gemini",
        llm_base_url="https://generativelanguage.googleapis.com/v1beta",
    )
    assert route.mode == "gemini_native"
    assert route.inject_web_search_tool is False
    assert route.native_web_search == "gemini"


def test_auto_ollama_falls_back_to_tool() -> None:
    route = resolve_web_search_route(
        web_search_enabled=True,
        web_search_provider="auto",
        llm_provider="ollama",
        llm_base_url="http://localhost:11434",
    )
    assert route.mode == "tool"
    assert route.inject_web_search_tool is True
    assert route.tool_provider == "duckduckgo"
    assert route.fallback_reason == "llm_ollama_no_native"


@pytest.mark.parametrize("provider", ["brave", "tavily", "perplexity", "serper"])
def test_manual_keyed_provider_forces_tool_even_on_openai(provider: str) -> None:
    route = resolve_web_search_route(
        web_search_enabled=True,
        web_search_provider=provider,
        llm_provider="openai",
        llm_base_url="https://api.openai.com/v1",
    )
    assert route.mode == "tool"
    assert route.tool_provider == provider
    assert route.inject_web_search_tool is True
    assert route.native_web_search is None


def test_openai_compatible_non_official_falls_back() -> None:
    route = resolve_web_search_route(
        web_search_enabled=True,
        web_search_provider="auto",
        llm_provider="openai",
        llm_base_url="https://api.deepseek.com/v1",
    )
    assert route.mode == "tool"
    assert route.fallback_reason == "openai_non_official_base"

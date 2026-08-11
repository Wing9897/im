"""Unit tests for LLM profile completeness rules."""

from __future__ import annotations

from server.analyzer.llm_profile_completeness import (
    is_profile_complete,
    profile_incompleteness_reason,
)
from server.secrets import protect_text


def test_ollama_requires_base_url_and_model() -> None:
    assert profile_incompleteness_reason(
        {"name": "A", "provider": "ollama", "base_url": "", "model": "m", "api_key": ""}
    )
    assert profile_incompleteness_reason(
        {
            "name": "A",
            "provider": "ollama",
            "base_url": "http://localhost:11434",
            "model": "",
            "api_key": "",
        }
    )
    assert is_profile_complete(
        {
            "name": "A",
            "provider": "ollama",
            "base_url": "http://localhost:11434",
            "model": "llama",
            "api_key": "",
        }
    )


def test_openai_compatible_requires_api_key() -> None:
    incomplete = {
        "name": "Cloud",
        "provider": "openai_compatible",
        "base_url": "https://api.openai.com/v1",
        "model": "gpt",
        "api_key": "",
    }
    assert "api_key" in (profile_incompleteness_reason(incomplete) or "")
    complete = {**incomplete, "api_key": protect_text("sk-secret")}
    assert is_profile_complete(complete)

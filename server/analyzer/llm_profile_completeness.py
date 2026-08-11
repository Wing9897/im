"""Concrete rules for whether an ``llm_profiles`` row is usable by tasks / agent."""

from __future__ import annotations

from typing import Any, Mapping

from server.analyzer.llm_config import WIRE_PROVIDERS, normalize_wire_provider
from server.secrets import unprotect_text

#: Providers that require a non-empty API key before a profile is usable.
_API_KEY_REQUIRED_PROVIDERS = frozenset(
    {"openai_compatible", "gemini_compatible", "openrouter"}
)


def profile_incompleteness_reason(row: Mapping[str, Any] | None) -> str | None:
    """Return a human-readable reason if the profile cannot drive LLM calls.

    Complete means:
    - ``name``, ``provider``, and ``model`` are non-empty
    - ``provider`` is a known wire id
    - ``ollama``: ``base_url`` and ``model`` non-empty (API key optional)
    - ``openai_compatible`` / ``gemini_compatible`` / ``openrouter``: stored
      ``api_key`` non-empty after decrypt (wire-masked values count as present)
    """
    if row is None:
        return "LLM profile is missing"
    name = str(row.get("name") or "").strip()
    if not name:
        return "LLM profile name is required"
    provider = normalize_wire_provider(str(row.get("provider") or ""))
    if provider not in WIRE_PROVIDERS:
        return f"LLM profile has unknown provider: {provider or '(empty)'}"
    model = str(row.get("model") or "").strip()
    if not model:
        return "LLM profile model is required"
    base_url = str(row.get("base_url") or "").strip()
    if provider == "ollama":
        if not base_url:
            return "Ollama LLM profile requires base_url"
        return None
    if provider in _API_KEY_REQUIRED_PROVIDERS:
        api_key = unprotect_text(row.get("api_key") or "")
        if not str(api_key).strip():
            return f"LLM profile provider {provider} requires api_key"
        return None
    return None


def is_profile_complete(row: Mapping[str, Any] | None) -> bool:
    return profile_incompleteness_reason(row) is None

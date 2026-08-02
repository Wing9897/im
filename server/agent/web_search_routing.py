"""Resolve assistant web-search mode from settings + active agent LLM.

Modes:
- ``off`` — master switch off; no tool injection, no native search tools
- ``tool`` — inject ``web.search`` (DuckDuckGo / Brave)
- ``openai_native`` — OpenAI Responses ``web_search``; do not inject ``web.search``
- ``gemini_native`` — Gemini Google Search grounding; do not inject ``web.search``
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal
from urllib.parse import urlparse

WebSearchMode = Literal["off", "tool", "openai_native", "gemini_native"]
ToolProvider = Literal["duckduckgo", "brave"]
NativeKind = Literal["openai", "gemini"]

_WEB_SEARCH_SETTING_PROVIDERS = frozenset({"auto", "duckduckgo", "brave"})


@dataclass(frozen=True, slots=True)
class WebSearchRoute:
    """Resolved search path for one agent turn."""

    enabled: bool
    mode: WebSearchMode
    #: Provider for the ``web.search`` tool path (also the auto→tool fallback).
    tool_provider: ToolProvider
    #: Setting value after normalization (``auto`` / ``duckduckgo`` / ``brave``).
    setting_provider: str
    #: When True, inject the custom ``web.search`` tool schema.
    inject_web_search_tool: bool
    #: Pass-through to LLM complete for hosted native search.
    native_web_search: NativeKind | None
    #: Machine-readable reason when auto could not use a native path.
    fallback_reason: str | None = None


def normalize_web_search_setting(raw: str | None) -> str:
    value = (raw or "").strip().lower()
    if value in _WEB_SEARCH_SETTING_PROVIDERS:
        return value
    # Legacy / unknown → keep DuckDuckGo (force tool), not auto.
    if value:
        return "duckduckgo"
    return "auto"


def is_official_openai_base(base_url: str) -> bool:
    host = (urlparse((base_url or "").strip()).hostname or "").lower()
    return host == "api.openai.com" or host.endswith(".openai.com")


def is_official_gemini_base(base_url: str) -> bool:
    host = (urlparse((base_url or "").strip()).hostname or "").lower()
    return host == "generativelanguage.googleapis.com"


def resolve_web_search_route(
    *,
    web_search_enabled: bool,
    web_search_provider: str | None,
    llm_provider: str | None,
    llm_base_url: str | None = None,
) -> WebSearchRoute:
    """Pick tool vs native search from master switch, search setting, and LLM."""
    setting = normalize_web_search_setting(web_search_provider)
    if not web_search_enabled:
        return WebSearchRoute(
            enabled=False,
            mode="off",
            tool_provider="duckduckgo",
            setting_provider=setting,
            inject_web_search_tool=False,
            native_web_search=None,
        )

    if setting in {"duckduckgo", "brave"}:
        return WebSearchRoute(
            enabled=True,
            mode="tool",
            tool_provider=setting,  # type: ignore[arg-type]
            setting_provider=setting,
            inject_web_search_tool=True,
            native_web_search=None,
        )

    # auto — follow assistant / chat LLM capability
    canonical = (llm_provider or "").strip().lower()
    base = (llm_base_url or "").strip()

    if canonical == "openai" and is_official_openai_base(base):
        return WebSearchRoute(
            enabled=True,
            mode="openai_native",
            tool_provider="duckduckgo",
            setting_provider="auto",
            inject_web_search_tool=False,
            native_web_search="openai",
        )

    if canonical == "gemini" and is_official_gemini_base(base):
        return WebSearchRoute(
            enabled=True,
            mode="gemini_native",
            tool_provider="duckduckgo",
            setting_provider="auto",
            inject_web_search_tool=False,
            native_web_search="gemini",
        )

    reason: str | None = None
    if canonical == "openai":
        reason = "openai_non_official_base"
    elif canonical == "gemini":
        reason = "gemini_non_official_base"
    elif canonical in {"ollama", "openrouter"}:
        reason = f"llm_{canonical}_no_native"
    elif canonical:
        reason = "llm_no_native"
    else:
        reason = "llm_unknown"

    return WebSearchRoute(
        enabled=True,
        mode="tool",
        tool_provider="duckduckgo",
        setting_provider="auto",
        inject_web_search_tool=True,
        native_web_search=None,
        fallback_reason=reason,
    )

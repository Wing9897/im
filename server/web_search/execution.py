"""Shared web-search execution for assistant / agent ``web.search`` tools.

Scheduled agent ticks with web search use ``AgentRuntime`` + ``build_agent_base_prompt``
(not a oneshot extract path). Callers pass count caps and whether search is enabled:

- Assistant / ``web.search`` tool: respect master switch (``enabled=False`` short-circuits).
- Scheduled ticks force ``enabled=True`` at route resolve time when still needed.
"""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Protocol

from server.domain.web_search_providers import KEYED_WEB_SEARCH_PROVIDERS
from server.web_search.providers import DEFAULT_COUNT, search_web

#: Assistant ``web.search`` tool default (alias of ``providers.DEFAULT_COUNT``).
ASSISTANT_TOOL_DEFAULT_COUNT = DEFAULT_COUNT


class SupportsLlmComplete(Protocol):
    async def complete(
        self,
        messages: list[dict[str, Any]],
        *,
        json_mode: bool = False,
        temperature: float = 0.2,
        native_web_search: str | None = None,
    ) -> dict[str, Any]: ...


def api_keys_from_mapping(row: Mapping[str, Any]) -> dict[str, str]:
    """Read ``{provider}_search_api_key`` columns / context keys."""
    return {
        provider: str(row.get(f"{provider}_search_api_key") or "") for provider in KEYED_WEB_SEARCH_PROVIDERS
    }


class WebSearchExecutionService:
    """Routing-aware provider search + optional native LLM web-search complete."""

    def __init__(self, *, api_keys: Mapping[str, str] | None = None) -> None:
        self._api_keys = {
            provider: str((api_keys or {}).get(provider) or "") for provider in KEYED_WEB_SEARCH_PROVIDERS
        }

    def _api_key_for(self, provider: str, override: str | None) -> str:
        if override is not None:
            return override
        return self._api_keys.get((provider or "").strip().lower(), "")

    async def tool_search(
        self,
        query: str,
        *,
        provider: str,
        count: int | None = None,
        enabled: bool = True,
        api_key: str | None = None,
    ) -> dict[str, Any]:
        """Run provider search. ``enabled=False`` returns a disabled stub (assistant)."""
        provider_name = (provider or "duckduckgo").strip() or "duckduckgo"
        if not enabled:
            return {
                "error": "web search is disabled",
                "items": [],
                "provider": provider_name,
                "count": 0,
            }
        cleaned = (query or "").strip()
        if not cleaned:
            return {
                "error": "query is required",
                "items": [],
                "count": 0,
                "provider": provider_name,
            }
        return await search_web(
            cleaned,
            provider=provider_name,
            api_key=self._api_key_for(provider_name, api_key),
            count=count,
        )

    async def native_complete(
        self,
        client: SupportsLlmComplete,
        messages: list[dict[str, Any]],
        *,
        native_kind: str,
        json_mode: bool = True,
        temperature: float = 0.2,
    ) -> dict[str, Any]:
        """One LLM call with hosted OpenAI / Gemini web search."""
        return await client.complete(
            messages,
            json_mode=json_mode,
            temperature=temperature,
            native_web_search=native_kind,
        )


__all__ = [
    "ASSISTANT_TOOL_DEFAULT_COUNT",
    "WebSearchExecutionService",
    "api_keys_from_mapping",
]

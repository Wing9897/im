"""Shared web-search execution for assistant / agent ``web.search`` tools.

Scheduled ``web_intel`` ticks use ``AgentRuntime`` + ``build_web_intel_base_prompt``
(not a oneshot extract path). Callers pass count caps and whether search is enabled:

- Assistant / ``web.search`` tool: respect master switch (``enabled=False`` short-circuits).
- Scheduled ticks force ``enabled=True`` at route resolve time when still needed.
"""

from __future__ import annotations

from typing import Any, Protocol

from server.web_search.providers import DEFAULT_COUNT, search_web

#: Assistant ``web.search`` tool default (also ``providers.DEFAULT_COUNT``).
ASSISTANT_TOOL_DEFAULT_COUNT = DEFAULT_COUNT

assert ASSISTANT_TOOL_DEFAULT_COUNT == DEFAULT_COUNT


class SupportsLlmComplete(Protocol):
    async def complete(
        self,
        messages: list[dict[str, Any]],
        *,
        json_mode: bool = False,
        temperature: float = 0.2,
        native_web_search: str | None = None,
    ) -> dict[str, Any]: ...


class WebSearchExecutionService:
    """Routing-aware provider search + optional native LLM web-search complete."""

    def __init__(self, *, brave_api_key: str = "") -> None:
        self._brave_api_key = brave_api_key or ""

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
            api_key=api_key if api_key is not None else self._brave_api_key,
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
]

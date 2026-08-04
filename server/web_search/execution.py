"""Shared web-search execution for assistant ``web.search`` tools.

Also retains a legacy ``extract_web_intel_items`` oneshot helper (no longer the
scheduled ``web_intel`` tick main path — ticks use ``AgentRuntime`` instead).

Callers pass count caps and whether search is enabled:

- Assistant / ``web.search`` tool: respect master switch (``enabled=False`` short-circuits).
- Scheduled ticks force ``enabled=True`` at route resolve time when still needed.
"""

from __future__ import annotations

from typing import Any, Protocol

from server.agent.web_search_routing import WebSearchRoute
from server.analyzer.llm_json import normalize_items, parse_json_response
from server.prompts.web_intel import (
    build_web_intel_native_user_prompt,
    build_web_intel_system_prompt,
    build_web_intel_tool_user_prompt,
    format_search_results_for_prompt,
)
from server.web_search.providers import DEFAULT_COUNT, MAX_COUNT, search_web

#: Scheduled web_intel tick result cap (tool path).
WEB_INTEL_SEARCH_COUNT = 8
#: Assistant ``web.search`` tool default (also ``providers.DEFAULT_COUNT``).
ASSISTANT_TOOL_DEFAULT_COUNT = DEFAULT_COUNT

assert WEB_INTEL_SEARCH_COUNT == MAX_COUNT
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
    """Routing-aware search + optional native one-step / tool two-step extraction."""

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

    async def extract_web_intel_items(
        self,
        client: SupportsLlmComplete,
        *,
        route: WebSearchRoute,
        search_query: str,
        prompt_template: str,
        ui_locale: str | None,
        count: int = WEB_INTEL_SEARCH_COUNT,
    ) -> tuple[list[dict[str, Any]], int, int, str]:
        """One extract path per fire: native **or** tool — no same-fire fallback.

        Callers force-enable search at route resolve time; if ``route.enabled`` is
        still false after that, this raises.
        """
        if not route.enabled:
            raise RuntimeError("web_intel search route resolved to disabled")

        system = build_web_intel_system_prompt(ui_locale=ui_locale)
        native_kind = route.native_web_search

        if native_kind in {"openai", "gemini"}:
            items, pt, ct = await self._native_one_step(
                client,
                system=system,
                search_query=search_query,
                prompt_template=prompt_template,
                native_kind=native_kind,
                ui_locale=ui_locale,
            )
            return items, pt, ct, f"{native_kind}_native"

        items, pt, ct = await self._tool_two_step(
            client,
            system=system,
            search_query=search_query,
            prompt_template=prompt_template,
            tool_provider=route.tool_provider,
            count=count,
            ui_locale=ui_locale,
        )
        return items, pt, ct, f"tool:{route.tool_provider}"

    async def _native_one_step(
        self,
        client: SupportsLlmComplete,
        *,
        system: str,
        search_query: str,
        prompt_template: str,
        native_kind: str,
        ui_locale: str | None,
    ) -> tuple[list[dict[str, Any]], int, int]:
        user = build_web_intel_native_user_prompt(
            search_query=search_query,
            prompt_template=prompt_template,
            ui_locale=ui_locale,
        )
        result = await self.native_complete(
            client,
            [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            native_kind=native_kind,
            json_mode=True,
            temperature=0.2,
        )
        parsed = parse_json_response(result["text"])
        return (
            [item for item in normalize_items(parsed) if isinstance(item, dict)],
            int(result.get("prompt_tokens") or 0),
            int(result.get("completion_tokens") or 0),
        )

    async def _tool_two_step(
        self,
        client: SupportsLlmComplete,
        *,
        system: str,
        search_query: str,
        prompt_template: str,
        tool_provider: str,
        count: int,
        ui_locale: str | None,
    ) -> tuple[list[dict[str, Any]], int, int]:
        search = await self.tool_search(
            search_query,
            provider=tool_provider,
            count=count,
            enabled=True,
        )
        if search.get("error") and not search.get("items"):
            raise RuntimeError(str(search["error"]))

        results_text = format_search_results_for_prompt(list(search.get("items") or []))
        user = build_web_intel_tool_user_prompt(
            search_query=search_query,
            prompt_template=prompt_template,
            search_results_text=results_text,
            ui_locale=ui_locale,
        )
        result = await client.complete(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            json_mode=True,
            temperature=0.2,
        )
        parsed = parse_json_response(result["text"])
        return (
            [item for item in normalize_items(parsed) if isinstance(item, dict)],
            int(result.get("prompt_tokens") or 0),
            int(result.get("completion_tokens") or 0),
        )


__all__ = [
    "ASSISTANT_TOOL_DEFAULT_COUNT",
    "WEB_INTEL_SEARCH_COUNT",
    "WebSearchExecutionService",
]

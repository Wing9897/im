"""Agent LLM completion with optional json_mode fallback."""

from __future__ import annotations

import logging
from typing import Any, Protocol

from server.agent.web_search_routing import WebSearchRoute, resolve_web_search_route
from server.analyzer.llm_client import load_agent_llm_config
from server.config import get_config, get_config_bool
from server.db.database import Database
from server.util import is_openai_json_mode_enabled

logger = logging.getLogger(__name__)


class LlmCompleter(Protocol):
    async def complete(
        self,
        messages: list[dict],
        temperature: float = 0.7,
        json_mode: bool = False,
        max_output_tokens: int | None = None,
        *,
        native_web_search: str | None = None,
    ) -> dict: ...

    async def close(self) -> None: ...


async def prefer_json_mode(db: Database, llm: LlmCompleter) -> bool:
    """Match analysis engine: Ollama always uses format=json; others follow openai_json_mode."""
    provider = getattr(llm, "provider", None)
    if provider == "ollama":
        return True
    return is_openai_json_mode_enabled(await get_config(db, "openai_json_mode"))


async def resolve_web_search_route_for_runtime(
    db: Database,
    llm: LlmCompleter,
    *,
    force_enabled: bool = False,
    force_disabled: bool = False,
) -> WebSearchRoute:
    if force_disabled:
        web_enabled = False
    elif force_enabled:
        web_enabled = True
    else:
        web_enabled = await get_config_bool(db, "assistant_web_search_enabled")
    setting = await get_config(db, "web_search_provider")
    llm_cfg = await load_agent_llm_config(db)
    # Prefer live client strings when set; ignore MagicMock auto-attrs.
    live_provider = getattr(llm, "provider", None)
    live_base = getattr(llm, "base_url", None)
    llm_provider = live_provider if isinstance(live_provider, str) and live_provider else llm_cfg["provider"]
    llm_base_url = live_base if isinstance(live_base, str) and live_base else llm_cfg["base_url"]
    return resolve_web_search_route(
        web_search_enabled=web_enabled,
        web_search_provider=setting,
        llm_provider=str(llm_provider),
        llm_base_url=str(llm_base_url or ""),
    )


async def complete_for_agent(
    db: Database,
    llm: LlmCompleter,
    history: list[dict[str, Any]],
    *,
    native_web_search: str | None = None,
) -> dict[str, Any]:
    """Complete with optional API json_mode; fall back if the provider rejects it.

    Settings 「AI 測試」uses json_mode=False. Forcing json_mode=True breaks many
    OpenAI-compatible endpoints that do not support response_format=json_object.
    """
    from server.web_search.execution import WebSearchExecutionService

    prefer = await prefer_json_mode(db, llm)
    service = WebSearchExecutionService()
    try:
        if native_web_search in {"openai", "gemini"}:
            return await service.native_complete(
                llm,
                history,
                native_kind=native_web_search,
                json_mode=prefer,
                temperature=0.2,
            )
        return await llm.complete(
            history,
            temperature=0.2,
            json_mode=prefer,
            native_web_search=None,
        )
    except Exception as exc:  # noqa: BLE001 — retry path for provider capability gaps
        if not prefer:
            raise
        logger.warning(
            "Agent LLM json_mode failed (%s); retrying without response_format/format=json",
            exc,
        )
        if native_web_search in {"openai", "gemini"}:
            return await service.native_complete(
                llm,
                history,
                native_kind=native_web_search,
                json_mode=False,
                temperature=0.2,
            )
        return await llm.complete(
            history,
            temperature=0.2,
            json_mode=False,
            native_web_search=None,
        )

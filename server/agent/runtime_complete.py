"""Agent LLM completion with optional json_mode fallback."""

from __future__ import annotations

import logging
from typing import Any, Protocol

from server.agent.web_search_routing import WebSearchRoute, resolve_web_search_route
from server.analyzer.llm_client import load_agent_llm_config
from server.db.database import Database
from server.domain.web_search_providers import WEB_SEARCH_PROVIDER_DEFAULT
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


def _profile_id_from_llm(llm: LlmCompleter) -> str | None:
    """Prefer the profile already bound on the live client (session override)."""
    raw = getattr(llm, "profile_id", None)
    if isinstance(raw, str) and raw.strip():
        return raw.strip()
    return None


async def prefer_json_mode(db: Database, llm: LlmCompleter) -> bool:
    """Match analysis engine: Ollama always uses format=json; others follow profile json_mode."""
    provider = getattr(llm, "provider", None)
    if provider == "ollama":
        return True
    llm_cfg = await load_agent_llm_config(db, profile_id=_profile_id_from_llm(llm))
    return is_openai_json_mode_enabled(llm_cfg.get("json_mode") or "disabled")


async def resolve_web_search_route_for_runtime(
    db: Database,
    llm: LlmCompleter,
    *,
    force_enabled: bool = False,
    force_disabled: bool = False,
) -> WebSearchRoute:
    llm_cfg = await load_agent_llm_config(db, profile_id=_profile_id_from_llm(llm))
    if force_disabled:
        web_enabled = False
    elif force_enabled:
        web_enabled = True
    else:
        web_enabled = bool(llm_cfg.get("web_search_enabled"))
    setting = str(llm_cfg.get("web_search_provider") or WEB_SEARCH_PROVIDER_DEFAULT)
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


def _agent_complete_attempts(
    *,
    prefer_json_mode: bool,
    native_web_search: str | None,
) -> list[tuple[bool, str | None]]:
    """Ordered (json_mode, native_web_search) retries for one agent turn."""
    plan: list[tuple[bool, str | None]] = []

    def add(json_mode: bool, native: str | None) -> None:
        key = (json_mode, native)
        if key not in plan:
            plan.append(key)

    native = native_web_search if native_web_search in {"openai", "gemini"} else None
    add(prefer_json_mode, native)
    if native is not None:
        add(prefer_json_mode, None)
    if prefer_json_mode:
        add(False, None)
    return plan


async def complete_for_agent(
    db: Database,
    llm: LlmCompleter,
    history: list[dict[str, Any]],
    *,
    native_web_search: str | None = None,
) -> dict[str, Any]:
    """Complete with optional API json_mode; fall back if the provider rejects it.

    Settings 「AI 測試」uses json_mode=False and never attaches hosted web-search
    tools. Assistant chat may route Gemini / OpenAI official endpoints through
    native search; when that fails (quota, unsupported model, etc.) we retry
    without hosted search so chat can still complete like the Settings probe.
    """
    from server.web_search.execution import WebSearchExecutionService

    prefer = await prefer_json_mode(db, llm)
    service = WebSearchExecutionService()
    attempts = _agent_complete_attempts(
        prefer_json_mode=prefer,
        native_web_search=native_web_search,
    )

    async def _call(*, json_mode: bool, native: str | None) -> dict[str, Any]:
        if native in {"openai", "gemini"}:
            return await service.native_complete(
                llm,
                history,
                native_kind=native,
                json_mode=json_mode,
                temperature=0.2,
            )
        return await llm.complete(
            history,
            temperature=0.2,
            json_mode=json_mode,
            native_web_search=None,
        )

    last_exc: Exception | None = None
    for index, (json_mode, native) in enumerate(attempts):
        try:
            return await _call(json_mode=json_mode, native=native)
        except Exception as exc:  # noqa: BLE001 — provider capability / quota gaps
            last_exc = exc
            if index + 1 >= len(attempts):
                break
            next_json_mode, next_native = attempts[index + 1]
            if native in {"openai", "gemini"} and next_native is None:
                logger.warning(
                    "Agent native web search failed (%s); retrying without hosted search",
                    exc,
                )
            elif json_mode and not next_json_mode:
                logger.warning(
                    "Agent LLM json_mode failed (%s); retrying without response_format/format=json",
                    exc,
                )
    assert last_exc is not None
    raise last_exc

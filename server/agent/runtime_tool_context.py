"""Build the per-turn tool-capability dict for ``AgentRuntime``."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from server.agent.web_search_routing import WebSearchRoute
from server.domain.web_search_providers import KEYED_WEB_SEARCH_PROVIDERS

if TYPE_CHECKING:
    from server.agent.runtime import AgentRuntime


async def build_agent_tool_context(
    runtime: AgentRuntime,
    *,
    user_event_origin: str = "assistant",
    workset_id: str | None = None,
    agent_scope_task_id: str | None = None,
    task_advisor_enabled: bool = False,
    calendar_writes_enabled: bool = True,
    calendar_read_enabled: bool = True,
    analysis_events_read_enabled: bool = True,
    items_read_enabled: bool = True,
    items_writes_enabled: bool = True,
    messages_search_enabled: bool = True,
    allowed_workset_ids: frozenset[str] | None = None,
    current_task: dict[str, Any] | None = None,
    locale: str | None = None,
    web_route: WebSearchRoute | None = None,
    force_web_search: bool = False,
) -> dict[str, Any]:
    route = web_route or await runtime._resolve_web_search_route(force_enabled=force_web_search)
    from server.analyzer.llm_config import load_agent_llm_config

    override = getattr(runtime.llm, "profile_id", None)
    profile_id = override.strip() if isinstance(override, str) and override.strip() else None
    llm_cfg = await load_agent_llm_config(runtime.db, profile_id=profile_id)
    stored_keys = llm_cfg.get("web_search_api_keys") or {}
    return {
        "web_search_enabled": route.enabled and route.inject_web_search_tool,
        "web_search_provider": route.tool_provider,
        "web_search_mode": route.mode,
        "native_web_search": route.native_web_search,
        "web_search_api_keys": {
            provider: str(stored_keys.get(provider) or "") for provider in KEYED_WEB_SEARCH_PROVIDERS
        },
        "web_fetch_count": 0,
        "user_event_origin": user_event_origin,
        "default_workset_id": workset_id,
        "agent_scope_task_id": agent_scope_task_id,
        "broadcaster": runtime.broadcaster,
        "task_advisor_enabled": task_advisor_enabled,
        "calendar_writes_enabled": calendar_writes_enabled,
        "calendar_read_enabled": calendar_read_enabled,
        "analysis_events_read_enabled": analysis_events_read_enabled,
        "items_read_enabled": items_read_enabled,
        "items_writes_enabled": items_writes_enabled,
        "messages_search_enabled": messages_search_enabled,
        "allowed_workset_ids": allowed_workset_ids,
        "current_task": current_task,
        "locale": locale,
    }

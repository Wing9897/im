"""Agent runtime: LLM message loop with JSON tool-calling protocol.

Uses a single project-wide JSON protocol (not native provider tools) so Ollama /
OpenAI-style / Gemini all share one path via ``ConfigurableLlmClient.complete``.

Prompt assembly: ``runtime_prompt``. Completion + json_mode fallback:
``runtime_complete``. Tool-context dict: ``runtime_tool_context``. Chat event
loop: ``runtime_loop``. Parse / tool-round helpers remain in sibling modules.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from server.agent.channels import AgentChannel, AgentChannelId, get_agent_channel
from server.agent.runtime_complete import (
    LlmCompleter,
    complete_for_agent,
    resolve_web_search_route_for_runtime,
)
from server.agent.runtime_loop import iter_agent_chat_events
from server.agent.runtime_prompt import build_system_prompt
from server.agent.runtime_tool_context import build_agent_tool_context
from server.agent.web_search_routing import WebSearchRoute
from server.db.database import Database
from server.prompts.assistant import AGENT_UNPARSEABLE_REPLY
from server.util import new_id

MAX_TOOL_ROUNDS = 8

__all__ = [
    "AgentRuntime",
    "LlmCompleter",
    "MAX_TOOL_ROUNDS",
    "build_system_prompt",
]


class AgentRuntime:
    """Run a multi-turn tool loop until the model returns a final message."""

    def __init__(
        self,
        db: Database,
        llm: LlmCompleter,
        *,
        max_tool_rounds: int = MAX_TOOL_ROUNDS,
        broadcaster: Any | None = None,
    ) -> None:
        self.db = db
        self.llm = llm
        self.max_tool_rounds = max_tool_rounds
        self.broadcaster = broadcaster

    async def _resolve_web_search_route(
        self,
        *,
        force_enabled: bool = False,
        force_disabled: bool = False,
    ) -> WebSearchRoute:
        return await resolve_web_search_route_for_runtime(
            self.db,
            self.llm,
            force_enabled=force_enabled,
            force_disabled=force_disabled,
        )

    async def _tool_context(
        self,
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
        return await build_agent_tool_context(
            self,
            user_event_origin=user_event_origin,
            workset_id=workset_id,
            agent_scope_task_id=agent_scope_task_id,
            task_advisor_enabled=task_advisor_enabled,
            calendar_writes_enabled=calendar_writes_enabled,
            calendar_read_enabled=calendar_read_enabled,
            analysis_events_read_enabled=analysis_events_read_enabled,
            items_read_enabled=items_read_enabled,
            items_writes_enabled=items_writes_enabled,
            messages_search_enabled=messages_search_enabled,
            allowed_workset_ids=allowed_workset_ids,
            current_task=current_task,
            locale=locale,
            web_route=web_route,
            force_web_search=force_web_search,
        )

    async def _complete_for_agent(
        self,
        history: list[dict[str, Any]],
        *,
        native_web_search: str | None = None,
    ) -> dict[str, Any]:
        return await complete_for_agent(
            self.db,
            self.llm,
            history,
            native_web_search=native_web_search,
        )

    async def iter_chat_events(
        self,
        messages: list[dict[str, Any]],
        *,
        session_id: str | None = None,
        locale: str | None = None,
        channel: AgentChannelId | str | None = "assistant",
        workset_id: str | None = None,
        agent_scope_task_id: str | None = None,
        surface: str | None = None,
        current_task: dict[str, Any] | None = None,
        base_prompt: str | None = None,
        policy: AgentChannel | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """Yield NDJSON/SSE-friendly progress events during the agent tool loop."""
        async for event in iter_agent_chat_events(
            self,
            messages,
            session_id=session_id,
            locale=locale,
            channel=channel,
            workset_id=workset_id,
            agent_scope_task_id=agent_scope_task_id,
            surface=surface,
            current_task=current_task,
            base_prompt=base_prompt,
            policy=policy,
        ):
            yield event

    async def chat(
        self,
        messages: list[dict[str, Any]],
        *,
        session_id: str | None = None,
        locale: str | None = None,
        channel: AgentChannelId | str | None = "assistant",
        workset_id: str | None = None,
        agent_scope_task_id: str | None = None,
        surface: str | None = None,
        current_task: dict[str, Any] | None = None,
        base_prompt: str | None = None,
        policy: AgentChannel | None = None,
    ) -> dict[str, Any]:
        final: dict[str, Any] | None = None
        async for event in self.iter_chat_events(
            messages,
            session_id=session_id,
            locale=locale,
            channel=channel,
            workset_id=workset_id,
            agent_scope_task_id=agent_scope_task_id,
            surface=surface,
            current_task=current_task,
            base_prompt=base_prompt,
            policy=policy,
        ):
            if event.get("type") == "final":
                final = event
        if final is None:
            channel_policy = policy if policy is not None else get_agent_channel(channel)
            sid = None if channel_policy.stateless else ((session_id or "").strip() or new_id())
            return {
                "message": AGENT_UNPARSEABLE_REPLY,
                "sessionId": sid,
                "toolCalls": [],
            }
        return final

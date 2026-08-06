"""Agent runtime: LLM message loop with JSON tool-calling protocol.

Uses a single project-wide JSON protocol (not native provider tools) so Ollama /
OpenAI-style / Gemini all share one path via ``ConfigurableLlmClient.complete``.

Prompt assembly: ``runtime_prompt``. Completion + json_mode fallback:
``runtime_complete``. Parse / tool-round helpers remain in sibling modules.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from server.agent.channels import AgentChannel, AgentChannelId, get_agent_channel
from server.agent.context_compact import (
    DEFAULT_MAX_CHARS as DEFAULT_HISTORY_MAX_CHARS,
)
from server.agent.context_compact import (
    DEFAULT_MAX_MESSAGES as DEFAULT_HISTORY_MAX_MESSAGES,
)
from server.agent.context_compact import (
    compact_agent_history,
)
from server.agent.runtime_complete import (
    LlmCompleter,
    complete_for_agent,
    resolve_web_search_route_for_runtime,
)
from server.agent.runtime_parse import (
    final_event as _final_event,
)
from server.agent.runtime_parse import (
    messages_for_channel as _messages_for_channel,
)
from server.agent.runtime_prompt import build_system_prompt
from server.agent.runtime_tool_round import run_tool_round
from server.agent.session_clock import resolve_conversation_clock
from server.agent.web_search_routing import WebSearchRoute
from server.config import get_config, get_config_int
from server.db.database import Database
from server.prompts.assistant import (
    AGENT_EMPTY_USER_MESSAGE,
    AGENT_HISTORY_OMIT_NOTICE,
    AGENT_TOOL_ROUNDS_EXHAUSTED,
    AGENT_UNPARSEABLE_REPLY,
)
from server.prompts.locale import normalize_ui_locale
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
        project_scope_task_id: str | None = None,
        task_advisor_enabled: bool = False,
        calendar_writes_enabled: bool = True,
        calendar_read_enabled: bool = True,
        analysis_events_read_enabled: bool = True,
        items_read_enabled: bool = True,
        current_task: dict[str, Any] | None = None,
        locale: str | None = None,
        web_route: WebSearchRoute | None = None,
        force_web_search: bool = False,
    ) -> dict[str, Any]:
        route = web_route or await self._resolve_web_search_route(force_enabled=force_web_search)
        brave_key = await get_config(self.db, "brave_search_api_key")
        return {
            "web_search_enabled": route.enabled and route.inject_web_search_tool,
            "web_search_provider": route.tool_provider,
            "web_search_mode": route.mode,
            "native_web_search": route.native_web_search,
            "brave_search_api_key": brave_key,
            "user_event_origin": user_event_origin,
            "default_workset_id": workset_id,
            "project_scope_task_id": project_scope_task_id,
            "broadcaster": self.broadcaster,
            "task_advisor_enabled": task_advisor_enabled,
            "calendar_writes_enabled": calendar_writes_enabled,
            "calendar_read_enabled": calendar_read_enabled,
            "analysis_events_read_enabled": analysis_events_read_enabled,
            "items_read_enabled": items_read_enabled,
            "current_task": current_task,
            "locale": locale,
        }

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
        project_scope_task_id: str | None = None,
        surface: str | None = None,
        current_task: dict[str, Any] | None = None,
        base_prompt: str | None = None,
        policy: AgentChannel | None = None,
    ) -> AsyncIterator[dict[str, Any]]:
        """Yield NDJSON/SSE-friendly progress events during the agent tool loop."""
        channel_policy = policy if policy is not None else get_agent_channel(channel)
        if channel_policy.stateless:
            sid = new_id()
            is_new_conversation = True
        else:
            sid_provided = (session_id or "").strip()
            sid = sid_provided or new_id()
            is_new_conversation = not bool(sid_provided)
        clock = resolve_conversation_clock(
            sid,
            is_new_conversation=is_new_conversation,
        )
        resolved_locale = (
            normalize_ui_locale(locale)
            if locale is not None and str(locale).strip()
            else normalize_ui_locale(await get_config(self.db, "ui_locale"))
        )
        # Task advisor is UI-gated (task editor + assistant channel only).
        task_advisor_enabled = channel_policy.id == "assistant" and surface == "task_editor"
        if channel_policy.id == "agent":
            search_on = channel_policy.force_web_search or channel_policy.web_search_enabled
            web_route = await self._resolve_web_search_route(
                force_enabled=search_on,
                force_disabled=not search_on,
            )
        else:
            web_route = await self._resolve_web_search_route(
                force_enabled=channel_policy.force_web_search,
            )
        user_background = await get_config(self.db, "user_background")
        tool_context = await self._tool_context(
            user_event_origin=channel_policy.user_event_origin,
            workset_id=workset_id,
            project_scope_task_id=project_scope_task_id,
            task_advisor_enabled=task_advisor_enabled,
            calendar_writes_enabled=channel_policy.calendar_writes_enabled,
            calendar_read_enabled=channel_policy.calendar_read_enabled,
            analysis_events_read_enabled=channel_policy.analysis_events_read_enabled,
            items_read_enabled=channel_policy.items_read_enabled,
            current_task=current_task if task_advisor_enabled else None,
            locale=resolved_locale if task_advisor_enabled else None,
            web_route=web_route,
            force_web_search=channel_policy.force_web_search,
        )
        native_web_search = web_route.native_web_search
        history: list[dict[str, Any]] = [
            {
                "role": "system",
                "content": build_system_prompt(
                    now=clock,
                    locale=resolved_locale,
                    web_search_enabled=web_route.enabled,
                    web_search_provider=web_route.tool_provider,
                    web_search_mode=web_route.mode,
                    inject_web_search_tool=web_route.inject_web_search_tool,
                    task_advisor_enabled=task_advisor_enabled,
                    calendar_writes_enabled=channel_policy.calendar_writes_enabled,
                    calendar_read_enabled=channel_policy.calendar_read_enabled,
                    analysis_events_read_enabled=channel_policy.analysis_events_read_enabled,
                    items_read_enabled=channel_policy.items_read_enabled,
                    user_background=user_background,
                    base_prompt=base_prompt if base_prompt is not None else channel_policy.system_prompt,
                ),
            }
        ]
        history.extend(_messages_for_channel(messages))

        if not any(m["role"] == "user" for m in history):
            yield _final_event(
                message=AGENT_EMPTY_USER_MESSAGE,
                session_id=None if channel_policy.stateless else sid,
                tool_calls=[],
            )
            return

        max_history_messages = await get_config_int(self.db, "agent_history_max_messages")
        max_history_chars = await get_config_int(self.db, "agent_history_max_chars")
        if max_history_messages <= 0:
            max_history_messages = DEFAULT_HISTORY_MAX_MESSAGES
        if max_history_chars <= 0:
            max_history_chars = DEFAULT_HISTORY_MAX_CHARS

        def _compact(current: list[dict[str, Any]]) -> list[dict[str, Any]]:
            # Stateless A2A: no server transcript store; still compact oversized
            # caller-supplied messages for this request only.
            return compact_agent_history(
                current,
                max_messages=max_history_messages,
                max_chars=max_history_chars,
                omit_notice=AGENT_HISTORY_OMIT_NOTICE,
            )

        history = _compact(history)

        tool_trace: list[dict[str, Any]] = []
        last_task_config: dict[str, Any] | None = None
        event_session_id = None if channel_policy.stateless else sid
        for round_index in range(self.max_tool_rounds + 1):
            round_result = await run_tool_round(
                db=self.db,
                history=history,
                round_index=round_index,
                max_tool_rounds=self.max_tool_rounds,
                tool_context=tool_context,
                tool_trace=tool_trace,
                last_task_config=last_task_config,
                complete_for_agent=self._complete_for_agent,
                native_web_search=native_web_search,
                compact=_compact,
                session_id=event_session_id,
            )
            last_task_config = round_result.last_task_config
            for event in round_result.events:
                yield event
            if round_result.kind == "final":
                return

        yield _final_event(
            message=AGENT_TOOL_ROUNDS_EXHAUSTED,
            session_id=event_session_id,
            tool_calls=tool_trace,
            task_config=last_task_config,
        )

    async def chat(
        self,
        messages: list[dict[str, Any]],
        *,
        session_id: str | None = None,
        locale: str | None = None,
        channel: AgentChannelId | str | None = "assistant",
        workset_id: str | None = None,
        project_scope_task_id: str | None = None,
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
            project_scope_task_id=project_scope_task_id,
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

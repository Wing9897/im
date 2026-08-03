"""Agent runtime: LLM message loop with JSON tool-calling protocol.

Uses a single project-wide JSON protocol (not native provider tools) so Ollama /
OpenAI-style / Gemini all share one path via ``ConfigurableLlmClient.complete``.
"""

from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from datetime import datetime
from typing import Any, Protocol

from server.agent.channels import AgentChannelId, get_agent_channel
from server.agent.context_compact import (
    DEFAULT_MAX_CHARS as DEFAULT_HISTORY_MAX_CHARS,
)
from server.agent.context_compact import (
    DEFAULT_MAX_MESSAGES as DEFAULT_HISTORY_MAX_MESSAGES,
)
from server.agent.context_compact import (
    compact_agent_history,
)
from server.agent.runtime_parse import (
    final_event as _final_event,
)
from server.agent.runtime_parse import (
    messages_for_channel as _messages_for_channel,
)
from server.agent.runtime_tool_round import run_tool_round
from server.agent.session_clock import resolve_conversation_clock
from server.agent.tools_registry import build_tool_schemas
from server.agent.web_search_routing import WebSearchRoute, resolve_web_search_route
from server.analyzer.llm_client import load_agent_llm_config
from server.config import get_config, get_config_bool, get_config_int
from server.db.database import Database
from server.prompts.assistant import (
    AGENT_EMPTY_USER_MESSAGE,
    AGENT_HISTORY_OMIT_NOTICE,
    AGENT_SYSTEM_PROMPT,
    AGENT_TOOL_ROUNDS_EXHAUSTED,
    AGENT_UNPARSEABLE_REPLY,
    task_advisor_prompt_note,
    web_search_prompt_note,
)
from server.prompts.clock import ASSISTANT_CLOCK_NOTE, current_time_prompt_block
from server.prompts.locale import normalize_ui_locale, output_language_directive
from server.util import is_openai_json_mode_enabled, new_id

logger = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 8


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


def _tools_prompt_block(*, inject_web_search_tool: bool, task_advisor_enabled: bool = False) -> str:
    return json.dumps(
        build_tool_schemas(
            web_search_enabled=inject_web_search_tool,
            task_advisor_enabled=task_advisor_enabled,
        ),
        ensure_ascii=False,
        indent=2,
    )


def build_system_prompt(
    *,
    now: datetime | None = None,
    locale: str | None = None,
    web_search_enabled: bool = True,
    web_search_provider: str = "duckduckgo",
    web_search_mode: str | None = None,
    inject_web_search_tool: bool | None = None,
    task_advisor_enabled: bool = False,
    base_prompt: str | None = None,
) -> str:
    inject_tool = web_search_enabled if inject_web_search_tool is None else inject_web_search_tool
    return (
        (base_prompt if base_prompt is not None else AGENT_SYSTEM_PROMPT)
        + current_time_prompt_block(now, authority_note=ASSISTANT_CLOCK_NOTE)
        + web_search_prompt_note(
            web_search_enabled=web_search_enabled,
            provider=web_search_provider,
            mode=web_search_mode,
        )
        + task_advisor_prompt_note(task_advisor_enabled=task_advisor_enabled)
        + _tools_prompt_block(
            inject_web_search_tool=inject_tool,
            task_advisor_enabled=task_advisor_enabled,
        )
        + "\n\n"
        + output_language_directive(normalize_ui_locale(locale))
    )


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

    async def _prefer_json_mode(self) -> bool:
        """Match analysis engine: Ollama always uses format=json; others follow openai_json_mode."""
        provider = getattr(self.llm, "provider", None)
        if provider == "ollama":
            return True
        return is_openai_json_mode_enabled(await get_config(self.db, "openai_json_mode"))

    async def _resolve_web_search_route(self) -> WebSearchRoute:
        web_enabled = await get_config_bool(self.db, "assistant_web_search_enabled")
        setting = await get_config(self.db, "web_search_provider")
        llm_cfg = await load_agent_llm_config(self.db)
        # Prefer live client strings when set; ignore MagicMock auto-attrs.
        live_provider = getattr(self.llm, "provider", None)
        live_base = getattr(self.llm, "base_url", None)
        llm_provider = live_provider if isinstance(live_provider, str) and live_provider else llm_cfg["provider"]
        llm_base_url = live_base if isinstance(live_base, str) and live_base else llm_cfg["base_url"]
        return resolve_web_search_route(
            web_search_enabled=web_enabled,
            web_search_provider=setting,
            llm_provider=str(llm_provider),
            llm_base_url=str(llm_base_url or ""),
        )

    async def _tool_context(
        self,
        *,
        user_event_origin: str = "assistant",
        workset_id: str | None = None,
        project_scope_task_id: str | None = None,
        task_advisor_enabled: bool = False,
        current_task: dict[str, Any] | None = None,
        locale: str | None = None,
        web_route: WebSearchRoute | None = None,
    ) -> dict[str, Any]:
        route = web_route or await self._resolve_web_search_route()
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
            "current_task": current_task,
            "locale": locale,
        }

    async def _complete_for_agent(
        self,
        history: list[dict[str, Any]],
        *,
        native_web_search: str | None = None,
    ) -> dict[str, Any]:
        """Complete with optional API json_mode; fall back if the provider rejects it.

        Settings 「AI 測試」uses json_mode=False. Forcing json_mode=True breaks many
        OpenAI-compatible endpoints that do not support response_format=json_object.
        """
        from server.web_search.execution import WebSearchExecutionService

        prefer = await self._prefer_json_mode()
        service = WebSearchExecutionService()
        try:
            if native_web_search in {"openai", "gemini"}:
                return await service.native_complete(
                    self.llm,
                    history,
                    native_kind=native_web_search,
                    json_mode=prefer,
                    temperature=0.2,
                )
            return await self.llm.complete(
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
                    self.llm,
                    history,
                    native_kind=native_web_search,
                    json_mode=False,
                    temperature=0.2,
                )
            return await self.llm.complete(
                history,
                temperature=0.2,
                json_mode=False,
                native_web_search=None,
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
    ) -> AsyncIterator[dict[str, Any]]:
        """Yield NDJSON/SSE-friendly progress events during the agent tool loop."""
        policy = get_agent_channel(channel)
        if policy.stateless:
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
        task_advisor_enabled = policy.id == "assistant" and surface == "task_editor"
        web_route = await self._resolve_web_search_route()
        tool_context = await self._tool_context(
            user_event_origin=policy.user_event_origin,
            workset_id=workset_id,
            project_scope_task_id=project_scope_task_id,
            task_advisor_enabled=task_advisor_enabled,
            current_task=current_task if task_advisor_enabled else None,
            locale=resolved_locale if task_advisor_enabled else None,
            web_route=web_route,
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
                    base_prompt=base_prompt if base_prompt is not None else policy.system_prompt,
                ),
            }
        ]
        history.extend(_messages_for_channel(messages))

        if not any(m["role"] == "user" for m in history):
            yield _final_event(
                message=AGENT_EMPTY_USER_MESSAGE,
                session_id=None if policy.stateless else sid,
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
        event_session_id = None if policy.stateless else sid
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
        ):
            if event.get("type") == "final":
                final = event
        if final is None:
            policy = get_agent_channel(channel)
            sid = None if policy.stateless else ((session_id or "").strip() or new_id())
            return {
                "message": AGENT_UNPARSEABLE_REPLY,
                "sessionId": sid,
                "toolCalls": [],
            }
        return final

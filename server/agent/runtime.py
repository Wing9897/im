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
    extract_final_message as _extract_final_message,
)
from server.agent.runtime_parse import (
    final_event as _final_event,
)
from server.agent.runtime_parse import (
    messages_for_channel as _messages_for_channel,
)
from server.agent.runtime_parse import (
    normalize_tool_calls as _normalize_tool_calls,
)
from server.agent.runtime_parse import (
    pick_task_config as _pick_task_config,
)
from server.agent.runtime_parse import (
    summarize_tool_result as _summarize_tool_result,
)
from server.agent.session_clock import resolve_conversation_clock
from server.agent.tools_registry import build_tool_schemas, execute_tool
from server.agent.tools_tasks import CONSULT_ADVISOR_TOOL_NAME
from server.analyzer.llm_json import parse_json_response
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
    ) -> dict: ...

    async def close(self) -> None: ...


def _tools_prompt_block(*, web_search_enabled: bool, task_advisor_enabled: bool = False) -> str:
    return json.dumps(
        build_tool_schemas(
            web_search_enabled=web_search_enabled,
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
    task_advisor_enabled: bool = False,
    base_prompt: str | None = None,
) -> str:
    return (
        (base_prompt if base_prompt is not None else AGENT_SYSTEM_PROMPT)
        + current_time_prompt_block(now, authority_note=ASSISTANT_CLOCK_NOTE)
        + web_search_prompt_note(web_search_enabled=web_search_enabled, provider=web_search_provider)
        + task_advisor_prompt_note(task_advisor_enabled=task_advisor_enabled)
        + _tools_prompt_block(
            web_search_enabled=web_search_enabled,
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

    async def _tool_context(
        self,
        *,
        user_event_origin: str = "assistant",
        workset_id: str | None = None,
        project_scope_task_id: str | None = None,
        task_advisor_enabled: bool = False,
        current_task: dict[str, Any] | None = None,
        locale: str | None = None,
    ) -> dict[str, Any]:
        web_enabled = await get_config_bool(self.db, "assistant_web_search_enabled")
        provider = (await get_config(self.db, "web_search_provider") or "duckduckgo").strip().lower()
        if provider not in {"duckduckgo", "brave"}:
            provider = "duckduckgo"
        brave_key = await get_config(self.db, "brave_search_api_key")
        return {
            "web_search_enabled": web_enabled,
            "web_search_provider": provider,
            "brave_search_api_key": brave_key,
            "user_event_origin": user_event_origin,
            "default_workset_id": workset_id,
            "project_scope_task_id": project_scope_task_id,
            "broadcaster": self.broadcaster,
            "task_advisor_enabled": task_advisor_enabled,
            "current_task": current_task,
            "locale": locale,
        }

    async def _complete_for_agent(self, history: list[dict[str, Any]]) -> dict[str, Any]:
        """Complete with optional API json_mode; fall back if the provider rejects it.

        Settings 「AI 測試」uses json_mode=False. Forcing json_mode=True breaks many
        OpenAI-compatible endpoints that do not support response_format=json_object.
        """
        prefer = await self._prefer_json_mode()
        try:
            return await self.llm.complete(history, temperature=0.2, json_mode=prefer)
        except Exception as exc:  # noqa: BLE001 — retry path for provider capability gaps
            if not prefer:
                raise
            logger.warning(
                "Agent LLM json_mode failed (%s); retrying without response_format/format=json",
                exc,
            )
            return await self.llm.complete(history, temperature=0.2, json_mode=False)

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
        tool_context = await self._tool_context(
            user_event_origin=policy.user_event_origin,
            workset_id=workset_id,
            project_scope_task_id=project_scope_task_id,
            task_advisor_enabled=task_advisor_enabled,
            current_task=current_task if task_advisor_enabled else None,
            locale=resolved_locale if task_advisor_enabled else None,
        )
        history: list[dict[str, Any]] = [
            {
                "role": "system",
                "content": build_system_prompt(
                    now=clock,
                    locale=resolved_locale,
                    web_search_enabled=bool(tool_context["web_search_enabled"]),
                    web_search_provider=str(tool_context["web_search_provider"]),
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
        for round_index in range(self.max_tool_rounds + 1):
            yield {"type": "llm_start", "round": round_index}

            history = _compact(history)
            result = await self._complete_for_agent(history)
            raw_text = str(result.get("text") or "")
            try:
                parsed = parse_json_response(raw_text)
            except ValueError:
                parsed = None

            tool_calls = _normalize_tool_calls(parsed) if parsed is not None else None
            if tool_calls and round_index < self.max_tool_rounds:
                history.append({"role": "assistant", "content": raw_text})
                tool_results: list[dict[str, Any]] = []
                for call in tool_calls:
                    name = call["name"]
                    arguments = call["arguments"]
                    yield {
                        "type": "tool_start",
                        "name": name,
                        "arguments": arguments,
                    }
                    executed = await execute_tool(self.db, name, arguments, context=tool_context)
                    picked = _pick_task_config(executed) if name == CONSULT_ADVISOR_TOOL_NAME else None
                    if picked is not None:
                        last_task_config = picked
                    summary = _summarize_tool_result(name, executed)
                    trace_entry = {
                        "name": name,
                        "arguments": arguments,
                        "resultSummary": summary,
                    }
                    tool_trace.append(trace_entry)
                    tool_results.append({"name": name, "result": executed})
                    yield {
                        "type": "tool_done",
                        "name": name,
                        "arguments": arguments,
                        "resultSummary": summary,
                    }
                history.append(
                    {
                        "role": "user",
                        "content": "Tool results (JSON):\n" + json.dumps(tool_results, ensure_ascii=False),
                    }
                )
                continue

            final = _extract_final_message(parsed, raw_text)
            if final is None:
                final = AGENT_UNPARSEABLE_REPLY
            yield _final_event(
                message=final,
                session_id=None if policy.stateless else sid,
                tool_calls=tool_trace,
                task_config=last_task_config,
            )
            return

        yield _final_event(
            message=AGENT_TOOL_ROUNDS_EXHAUSTED,
            session_id=None if policy.stateless else sid,
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

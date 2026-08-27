"""Chat event loop for ``AgentRuntime.iter_chat_events``."""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import TYPE_CHECKING, Any

from server.agent.channels import AgentChannel, AgentChannelId, apply_household_tool_caps, get_agent_channel
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
from server.agent.runtime_prompt import build_system_prompt
from server.agent.runtime_tool_round import run_tool_round
from server.agent.session_clock import resolve_conversation_clock
from server.config import get_config, get_config_int
from server.prompts.assistant import (
    AGENT_EMPTY_USER_MESSAGE,
    AGENT_HISTORY_OMIT_NOTICE,
    AGENT_TOOL_ROUNDS_EXHAUSTED,
)
from server.prompts.locale import normalize_ui_locale
from server.util import new_id

if TYPE_CHECKING:
    from server.agent.runtime import AgentRuntime


async def iter_agent_chat_events(
    runtime: AgentRuntime,
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
    channel_policy = policy if policy is not None else get_agent_channel(channel)
    if channel_policy.id == "a2a":
        from server.agent.mcp_tools import load_mcp_capabilities
        from server.queries.worksets_queries import fetch_external_enabled_workset_ids

        caps = await load_mcp_capabilities(runtime.db)
        channel_policy = apply_household_tool_caps(channel_policy, caps)
        allowed_workset_ids = await fetch_external_enabled_workset_ids(runtime.db)
    else:
        allowed_workset_ids = None
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
        else normalize_ui_locale(await get_config(runtime.db, "ui_locale"))
    )
    # Task advisor is UI-gated (task editor + assistant channel only).
    task_advisor_enabled = channel_policy.id == "assistant" and surface == "task_editor"
    if channel_policy.id == "agent":
        search_on = channel_policy.force_web_search or channel_policy.web_search_enabled
        web_route = await runtime._resolve_web_search_route(
            force_enabled=search_on,
            force_disabled=not search_on,
        )
    else:
        web_route = await runtime._resolve_web_search_route(
            force_enabled=channel_policy.force_web_search,
        )
    user_background = await get_config(runtime.db, "user_background")
    tool_context = await runtime._tool_context(
        user_event_origin=channel_policy.user_event_origin,
        workset_id=workset_id,
        agent_scope_task_id=agent_scope_task_id,
        task_advisor_enabled=task_advisor_enabled,
        calendar_writes_enabled=channel_policy.calendar_writes_enabled,
        calendar_read_enabled=channel_policy.calendar_read_enabled,
        analysis_events_read_enabled=channel_policy.analysis_events_read_enabled,
        items_read_enabled=channel_policy.items_read_enabled,
        items_writes_enabled=channel_policy.items_writes_enabled,
        messages_search_enabled=channel_policy.messages_search_enabled,
        allowed_workset_ids=allowed_workset_ids,
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
                items_writes_enabled=channel_policy.items_writes_enabled,
                messages_search_enabled=channel_policy.messages_search_enabled,
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

    max_history_messages = await get_config_int(runtime.db, "agent_history_max_messages")
    max_history_chars = await get_config_int(runtime.db, "agent_history_max_chars")
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
    for round_index in range(runtime.max_tool_rounds + 1):
        round_result = await run_tool_round(
            db=runtime.db,
            history=history,
            round_index=round_index,
            max_tool_rounds=runtime.max_tool_rounds,
            tool_context=tool_context,
            tool_trace=tool_trace,
            last_task_config=last_task_config,
            complete_for_agent=runtime._complete_for_agent,
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

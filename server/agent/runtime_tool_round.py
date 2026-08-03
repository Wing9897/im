"""One tool-calling round inside ``AgentRuntime.iter_chat_events``."""

from __future__ import annotations

import json
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from typing import Any, Literal

from server.agent.runtime_parse import (
    extract_final_message as _extract_final_message,
)
from server.agent.runtime_parse import (
    final_event as _final_event,
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
from server.agent.tools_registry import execute_tool
from server.agent.tools_tasks import CONSULT_ADVISOR_TOOL_NAME
from server.analyzer.llm_json import parse_json_response
from server.db.database import Database
from server.prompts.assistant import AGENT_UNPARSEABLE_REPLY

RoundKind = Literal["continue", "final"]


@dataclass
class ToolRoundResult:
    """Outcome of a single LLM completion + optional tool executions."""

    kind: RoundKind
    events: list[dict[str, Any]] = field(default_factory=list)
    last_task_config: dict[str, Any] | None = None


async def run_tool_round(
    *,
    db: Database,
    history: list[dict[str, Any]],
    round_index: int,
    max_tool_rounds: int,
    tool_context: dict[str, Any],
    tool_trace: list[dict[str, Any]],
    last_task_config: dict[str, Any] | None,
    complete_for_agent: Callable[..., Awaitable[dict[str, Any]]],
    native_web_search: str | None,
    compact: Callable[[list[dict[str, Any]]], list[dict[str, Any]]],
    session_id: str | None,
) -> ToolRoundResult:
    """Run one LLM round; append tool turns to ``history`` when continuing."""
    events: list[dict[str, Any]] = [{"type": "llm_start", "round": round_index}]

    compacted = compact(history)
    history.clear()
    history.extend(compacted)
    result = await complete_for_agent(
        history,
        native_web_search=native_web_search,
    )
    raw_text = str(result.get("text") or "")
    try:
        parsed = parse_json_response(raw_text)
    except ValueError:
        parsed = None

    tool_calls = _normalize_tool_calls(parsed) if parsed is not None else None
    if tool_calls and round_index < max_tool_rounds:
        history.append({"role": "assistant", "content": raw_text})
        tool_results: list[dict[str, Any]] = []
        next_config = last_task_config
        for call in tool_calls:
            name = call["name"]
            arguments = call["arguments"]
            events.append(
                {
                    "type": "tool_start",
                    "name": name,
                    "arguments": arguments,
                }
            )
            executed = await execute_tool(db, name, arguments, context=tool_context)
            picked = _pick_task_config(executed) if name == CONSULT_ADVISOR_TOOL_NAME else None
            if picked is not None:
                next_config = picked
            summary = _summarize_tool_result(name, executed)
            tool_trace.append(
                {
                    "name": name,
                    "arguments": arguments,
                    "resultSummary": summary,
                }
            )
            tool_results.append({"name": name, "result": executed})
            events.append(
                {
                    "type": "tool_done",
                    "name": name,
                    "arguments": arguments,
                    "resultSummary": summary,
                }
            )
        history.append(
            {
                "role": "user",
                "content": "Tool results (JSON):\n" + json.dumps(tool_results, ensure_ascii=False),
            }
        )
        return ToolRoundResult(kind="continue", events=events, last_task_config=next_config)

    final = _extract_final_message(parsed, raw_text)
    if final is None:
        final = AGENT_UNPARSEABLE_REPLY
    events.append(
        _final_event(
            message=final,
            session_id=session_id,
            tool_calls=tool_trace,
            task_config=last_task_config,
        )
    )
    return ToolRoundResult(kind="final", events=events, last_task_config=last_task_config)


__all__ = ["ToolRoundResult", "run_tool_round"]

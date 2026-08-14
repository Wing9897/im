"""Serialize / parse / seed helpers for agent ticks (shared by entry + drain)."""

from __future__ import annotations

import json
from contextlib import suppress
from typing import Any

from server.analyzer.llm_json import normalize_items, parse_json_response
from server.domain.agent_task_spec import AgentTaskSpecError, agent_task_spec_from_row
from server.prompts.agent_task import build_agent_seed_message
from server.queries.agent_tick_queries import AgentMessageCursor

#: Fallback when ``agent_max_tool_rounds`` config is missing / non-positive.
#: Matches ``server.config`` default (28). Assistant chat keeps runtime default 8.
DEFAULT_AGENT_MAX_TOOL_ROUNDS = 28
DEFAULT_AGENT_MAX_TOOL_ROUNDS_CURSOR = DEFAULT_AGENT_MAX_TOOL_ROUNDS
DEFAULT_AGENT_MAX_DRAIN_WAVES = 0
MESSAGE_SUMMARY_LIMIT = 40
_AGENT_MESSAGE_LIMIT = 2000
_TOOL_CALLS_MAX = 40
_TOOL_ARGS_JSON_LIMIT = 400
_TOOL_RESULT_SUMMARY_LIMIT = 500
_SKIP_NO_MESSAGES = "skipped: no new messages"
_SKIP_EMPTY_PROMPT = "skipped: empty prompt_template"


def truncate_text(value: str, limit: int) -> str:
    text = value.strip()
    if len(text) <= limit:
        return text
    if limit <= 1:
        return text[:limit]
    return text[: limit - 1] + "…"


def serialize_tick_tool_calls(tool_calls: Any) -> str:
    """Compact JSON array for ``analysis_batches.tool_calls_json``."""
    if not isinstance(tool_calls, list):
        return "[]"
    entries: list[dict[str, Any]] = []
    for item in tool_calls:
        if not isinstance(item, dict):
            continue
        name = item.get("name")
        if not isinstance(name, str) or not name.strip():
            continue
        entry: dict[str, Any] = {"name": name.strip()}
        arguments = item.get("arguments")
        if isinstance(arguments, dict):
            raw_args = json.dumps(arguments, ensure_ascii=False, sort_keys=True)
            if len(raw_args) > _TOOL_ARGS_JSON_LIMIT:
                entry["arguments"] = {"_truncated": truncate_text(raw_args, _TOOL_ARGS_JSON_LIMIT)}
            else:
                entry["arguments"] = arguments
        summary = item.get("resultSummary")
        if isinstance(summary, str) and summary.strip():
            entry["resultSummary"] = truncate_text(summary, _TOOL_RESULT_SUMMARY_LIMIT)
        entries.append(entry)
        if len(entries) >= _TOOL_CALLS_MAX:
            break
    return json.dumps(entries, ensure_ascii=False)


def parse_agent_items(final_message: str) -> list[dict[str, Any]]:
    """Parse Agent final text into analysis-event item dicts."""
    text = (final_message or "").strip()
    if not text:
        return []
    parsed = parse_json_response(text)
    if isinstance(parsed, dict) and "items" not in parsed:
        nested = parsed.get("message")
        if isinstance(nested, str) and nested.strip():
            with suppress(ValueError):
                parsed = parse_json_response(nested)
    return [item for item in normalize_items(parsed) if isinstance(item, dict)]


def build_agent_tick_seed(
    *,
    task: dict[str, Any],
    calendar_summary: str,
    message_lines: list[str],
    cursor: AgentMessageCursor | str | None,
    wave_index: int = 1,
    wave_total_hint: str | None = None,
) -> str:
    """User-turn seed for one drain wave (compat helper for tests)."""
    cursor_label = cursor.timestamp if isinstance(cursor, AgentMessageCursor) else cursor
    try:
        spec = agent_task_spec_from_row(task, has_channels=True)
    except AgentTaskSpecError:
        from server.domain.agent_task_spec import agent_preset_spec

        spec = agent_preset_spec("project_reconcile", has_channels=True)
    return build_agent_seed_message(
        task_name=str(task.get("name") or task.get("id") or "agent"),
        task_id=str(task["id"]),
        spec=spec,
        calendar_summary=calendar_summary,
        message_lines=message_lines,
        cursor_label=cursor_label,
        wave_index=wave_index,
        wave_total_hint=wave_total_hint,
    )


__all__ = [
    "DEFAULT_AGENT_MAX_DRAIN_WAVES",
    "DEFAULT_AGENT_MAX_TOOL_ROUNDS",
    "DEFAULT_AGENT_MAX_TOOL_ROUNDS_CURSOR",
    "MESSAGE_SUMMARY_LIMIT",
    "_AGENT_MESSAGE_LIMIT",
    "_SKIP_EMPTY_PROMPT",
    "_SKIP_NO_MESSAGES",
    "build_agent_tick_seed",
    "parse_agent_items",
    "serialize_tick_tool_calls",
    "truncate_text",
]

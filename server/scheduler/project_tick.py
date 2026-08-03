"""Closed-loop project-manager tick: AgentRuntime (not execute_batch).

On each schedule fire: if there are no new bound-source messages since the
cursor, skip the LLM entirely (no token spend). Otherwise drain the backlog
in waves (default 40 messages/wave) inside one continuing conversation
(pinned system + task goals; compacted history), advancing the cursor only
after a successful wave, until the queue is empty or pause/disable/optional
wave-cap stops the fire. Between waves, cool for the task's
``project_wave_interval_seconds`` (NULL → 20; 0 = no sleep).

Wave / drain loop lives in ``project_tick_drain``.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from server.agent.runtime import AgentRuntime
from server.analyzer.llm_client import ConfigurableLlmClient
from server.config import get_config_bool, get_config_int
from server.db.database import Database
from server.domain.analysis_modes import PARENT_PROJECT_MODE
from server.queries.project_tick_queries import (
    ProjectMessageCursor,
    complete_project_batch,
    ensure_project_batch,
    fetch_project_messages_since,
    load_project_message_cursor,
)
from server.scheduler.batch_claim import load_task
from server.scheduler.task_schedule_overrides import resolve_project_wave_interval_seconds
from server.sse import Broadcaster

logger = logging.getLogger(__name__)

DEFAULT_PROJECT_MAX_TOOL_ROUNDS = 28
#: 0 = unlimited drain waves (default). Positive values are an optional safety cap.
DEFAULT_PROJECT_MAX_DRAIN_WAVES = 0
#: Page size for each drain wave (imported by tests / drain module).
MESSAGE_SUMMARY_LIMIT = 40
# Backward-compatible private alias used by test_project_tick.
_MESSAGE_SUMMARY_LIMIT = MESSAGE_SUMMARY_LIMIT
_AGENT_MESSAGE_LIMIT = 2000
_TOOL_CALLS_MAX = 40
_TOOL_ARGS_JSON_LIMIT = 400
_TOOL_RESULT_SUMMARY_LIMIT = 500
_SKIP_NO_MESSAGES = "skipped: no new messages"


def _truncate_text(value: str, limit: int) -> str:
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
                entry["arguments"] = {"_truncated": _truncate_text(raw_args, _TOOL_ARGS_JSON_LIMIT)}
            else:
                entry["arguments"] = arguments
        summary = item.get("resultSummary")
        if isinstance(summary, str) and summary.strip():
            entry["resultSummary"] = _truncate_text(summary, _TOOL_RESULT_SUMMARY_LIMIT)
        entries.append(entry)
        if len(entries) >= _TOOL_CALLS_MAX:
            break
    return json.dumps(entries, ensure_ascii=False)


async def _complete_batch(
    db: Database,
    batch_id: str,
    *,
    error_message: str | None = None,
    agent_message: str | None = None,
    tool_calls: Any = None,
    message_count: int | None = None,
) -> None:
    if error_message:
        await complete_project_batch(
            db,
            batch_id,
            error_message=error_message,
            message_count=message_count,
        )
        return

    message = None
    if isinstance(agent_message, str) and agent_message.strip():
        message = _truncate_text(agent_message, _AGENT_MESSAGE_LIMIT)
    await complete_project_batch(
        db,
        batch_id,
        agent_message=message,
        tool_calls_json=serialize_tick_tool_calls(tool_calls),
        message_count=message_count,
    )


def build_project_seed_message(
    *,
    task: dict[str, Any],
    calendar_summary: str,
    message_lines: list[str],
    cursor: ProjectMessageCursor | str | None,
    wave_index: int = 1,
    wave_total_hint: str | None = None,
) -> str:
    """User-turn seed for one drain wave (goals live in pinned system prompt)."""
    name = str(task.get("name") or task.get("id") or "project")
    if isinstance(cursor, ProjectMessageCursor):
        cursor_label = cursor.timestamp
    else:
        cursor_label = cursor
    parts = [
        f"Project tick for «{name}» (task_id={task['id']}).",
        f"Drain wave {wave_index}" + (f" ({wave_total_hint})" if wave_total_hint else "") + ".",
        "Follow the pinned Project goals / rules in the system prompt.",
        "",
        "## Current calendar summary",
        calendar_summary,
        "",
        "## Incremental source messages",
    ]
    if message_lines:
        parts.append(f"New messages since cursor {cursor_label or '(start)'}:")
        parts.extend(message_lines)
        parts.append(
            "Process these messages now: create / update / soft-delete owned "
            "user_events and child recurring tasks as needed before finishing. "
            "Stay consistent with earlier waves in this same conversation."
        )
    else:
        # Production ticks skip the LLM when empty; kept for unit/seed tests.
        parts.append(
            f"No new messages since cursor {cursor_label or '(start)'}. "
            "Do not invent work; finish with a short message."
        )
    parts.extend(
        [
            "",
            "Use tools as needed, then finish with a short JSON message summarizing changes.",
        ]
    )
    return "\n".join(parts)


async def execute_project_tick(
    *,
    db: Database,
    broadcaster: Broadcaster,
    task_id: str,
    analysis_paused: bool | None = None,
) -> None:
    """Drain new project messages via Agent waves; skip LLM when the queue is empty."""
    # Local import avoids a circular load with project_tick_drain → seed helpers.
    from server.scheduler.project_tick_drain import drain_project_waves

    if analysis_paused is None:
        analysis_paused = await get_config_bool(db, "analysis_paused")
    if analysis_paused:
        return

    task = await load_task(db, task_id)
    if task is None or not task.get("is_active"):
        return
    if str(task.get("analysis_mode") or "") != PARENT_PROJECT_MODE:
        return

    cursor = await load_project_message_cursor(db, task_id)
    messages = await fetch_project_messages_since(
        db,
        task_id=task_id,
        since=cursor,
        limit=MESSAGE_SUMMARY_LIMIT,
    )

    if not messages:
        batch_id = await ensure_project_batch(db, task, message_count=0)
        await _complete_batch(
            db,
            batch_id,
            agent_message=_SKIP_NO_MESSAGES,
            tool_calls=[],
            message_count=0,
        )
        logger.info("Project tick %s skipped: no new messages", task_id)
        return

    batch_id = await ensure_project_batch(db, task, message_count=len(messages))

    max_rounds = await get_config_int(db, "agent_project_max_tool_rounds")
    if max_rounds <= 0:
        max_rounds = DEFAULT_PROJECT_MAX_TOOL_ROUNDS

    # 0 = unlimited (product default). Positive = optional safety cap.
    max_waves = await get_config_int(db, "agent_project_max_drain_waves")
    if max_waves < 0:
        max_waves = DEFAULT_PROJECT_MAX_DRAIN_WAVES

    wave_interval = resolve_project_wave_interval_seconds(task)

    llm: ConfigurableLlmClient | None = None
    total_messages = 0

    try:
        llm = await ConfigurableLlmClient.from_db_for_agent(db)
        runtime = AgentRuntime(
            db,
            llm,
            max_tool_rounds=max_rounds,
            broadcaster=broadcaster,
        )
        drain = await drain_project_waves(
            db=db,
            runtime=runtime,
            task=task,
            task_id=task_id,
            batch_id=batch_id,
            messages=messages,
            cursor=cursor,
            max_waves=max_waves,
            wave_interval=wave_interval,
        )
        total_messages = drain.total_messages
        combined = "\n".join(drain.wave_summaries) if drain.wave_summaries else "project tick completed"
        await _complete_batch(
            db,
            batch_id,
            agent_message=combined,
            tool_calls=drain.all_tool_calls,
            message_count=total_messages,
        )
        if broadcaster is not None:
            from server.sse import publish_resource_modified

            publish_resource_modified(
                broadcaster,
                resource_type="task",
                resource_id=task_id,
                action="updated",
            )
    except Exception as exc:  # noqa: BLE001 — tick must not kill scheduler capacity
        logger.exception("Project tick failed for task %s", task_id)
        await _complete_batch(
            db,
            batch_id,
            error_message=str(exc),
            message_count=total_messages or None,
        )
    finally:
        if llm is not None:
            await llm.close()


# Re-export seed helpers for tests; cursor I/O lives in project_tick_queries.
__all__ = [
    "DEFAULT_PROJECT_MAX_DRAIN_WAVES",
    "DEFAULT_PROJECT_MAX_TOOL_ROUNDS",
    "MESSAGE_SUMMARY_LIMIT",
    "build_project_seed_message",
    "execute_project_tick",
    "serialize_tick_tool_calls",
]

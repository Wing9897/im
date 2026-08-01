"""Closed-loop project-manager tick: AgentRuntime (not execute_batch).

On each schedule fire: if there are no new bound-source messages since the
cursor, skip the LLM entirely (no token spend). Otherwise drain the backlog
in waves (default 40 messages/wave) inside one continuing conversation
(pinned system + task goals; compacted history), advancing the cursor only
after a successful wave, until the queue is empty or pause/disable/optional
wave-cap stops the fire. Between waves, cool for the task's
``project_wave_interval_seconds`` (NULL → 20; 0 = no sleep).
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from server.agent.runtime import AgentRuntime
from server.analyzer.llm_client import ConfigurableLlmClient
from server.calendar.query import query_upcoming
from server.config import get_config_bool, get_config_int
from server.db.database import Database
from server.domain.analysis_modes import CHILD_RECURRING_MODE, PARENT_PROJECT_MODE
from server.prompts.project import build_project_base_prompt
from server.queries.project_tick_queries import (
    ProjectMessageCursor,
    complete_project_batch,
    ensure_project_batch,
    fetch_project_calendar_children,
    fetch_project_messages_since,
    load_project_message_cursor,
    store_project_message_cursor,
    update_project_batch_message_count,
)
from server.scheduler.batch_claim import load_task
from server.scheduler.task_schedule_overrides import resolve_project_wave_interval_seconds
from server.sse import Broadcaster
from server.calendar.timeline_dismissals import active_timeline_items

logger = logging.getLogger(__name__)

DEFAULT_PROJECT_MAX_TOOL_ROUNDS = 28
#: 0 = unlimited drain waves (default). Positive values are an optional safety cap.
DEFAULT_PROJECT_MAX_DRAIN_WAVES = 0
_MESSAGE_SUMMARY_LIMIT = 40
_CONTENT_TRUNCATE = 280
_AGENT_MESSAGE_LIMIT = 2000
_TOOL_CALLS_MAX = 40
_TOOL_ARGS_JSON_LIMIT = 400
_TOOL_RESULT_SUMMARY_LIMIT = 500
_SKIP_NO_MESSAGES = "skipped: no new messages"


def _compact_message_line(row: dict[str, Any]) -> str:
    content = str(row.get("content") or "").replace("\n", " ").strip()
    if len(content) > _CONTENT_TRUNCATE:
        content = content[: _CONTENT_TRUNCATE - 1] + "…"
    channel = row.get("channel_name") or f"{row.get('platform')}:{row.get('platform_id')}"
    sender = row.get("sender_name") or ""
    ts = row.get("timestamp") or ""
    who = f"{sender} @ " if sender else ""
    return f"- [{ts}] {who}{channel}: {content}"


async def _calendar_summary(db: Database, task_id: str) -> str:
    result = await query_upcoming(db, limit=40, days=30, task_id=task_id, hard_cap=80)
    items = active_timeline_items(result.get("items") or [])
    children = await fetch_project_calendar_children(db, task_id, CHILD_RECURRING_MODE)
    lines = [
        f"Owned user_events / occurrences in next ~30 days: {len(items)}",
    ]
    for item in items[:25]:
        title = item.get("title") or item.get("topicName") or "(untitled)"
        start = item.get("startTime") or item.get("eventTime") or ""
        source = item.get("source") or ""
        lines.append(f"- [{source}] {start} {title}")
    if len(items) > 25:
        lines.append(f"- … and {len(items) - 25} more")
    lines.append(f"Child recurring tasks: {len(children)}")
    for child in children:
        active = "active" if child.get("is_active") else "inactive"
        clock = child.get("event_start_time") or ("all-day" if child.get("event_is_all_day") else "")
        lines.append(
            f"- {child.get('id')} {child.get('name')} ({active}) rrule={child.get('rrule') or ''} clock={clock}"
        )
    return "\n".join(lines)


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


def _wave_carry_assistant_message(
    *,
    agent_message: str,
    tool_calls: Any,
) -> str:
    """Compact prior-wave result kept in the continuing dialogue."""
    names: list[str] = []
    if isinstance(tool_calls, list):
        for item in tool_calls:
            if isinstance(item, dict):
                name = item.get("name")
                if isinstance(name, str) and name.strip():
                    names.append(name.strip())
    payload: dict[str, Any] = {
        "message": (agent_message or "").strip() or "(no summary)",
    }
    if names:
        payload["toolsUsed"] = names[:20]
    return json.dumps(payload, ensure_ascii=False)


async def _drain_stop_reason(db: Database, task_id: str) -> str | None:
    """Return a human reason to halt before the next wave, or None to continue.

    Honours task enablement and global analysis pause (including emergency abort,
    which sets ``analysis_paused``). Does not cancel an in-flight LLM wave.
    """
    if await get_config_bool(db, "analysis_paused"):
        return "analysis paused / emergency stop"
    task = await load_task(db, task_id)
    if task is None:
        return "task missing"
    if not task.get("is_active"):
        return "task disabled"
    if str(task.get("analysis_mode") or "") != PARENT_PROJECT_MODE:
        return "task no longer in project mode"
    return None


async def execute_project_tick(
    *,
    db: Database,
    broadcaster: Broadcaster,
    task_id: str,
    analysis_paused: bool | None = None,
) -> None:
    """Drain new project messages via Agent waves; skip LLM when the queue is empty."""
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
        limit=_MESSAGE_SUMMARY_LIMIT,
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
    unlimited = max_waves == 0

    wave_interval = resolve_project_wave_interval_seconds(task)

    llm: ConfigurableLlmClient | None = None
    total_messages = 0
    all_tool_calls: list[Any] = []
    wave_summaries: list[str] = []

    try:
        llm = await ConfigurableLlmClient.from_db_for_agent(db)
        runtime = AgentRuntime(
            db,
            llm,
            max_tool_rounds=max_rounds,
            broadcaster=broadcaster,
        )

        wave_index = 0
        drained = False
        deferred_reason: str | None = None
        session_id: str | None = None
        carry_messages: list[dict[str, str]] = []
        pinned_base_prompt = build_project_base_prompt(str(task.get("prompt_template") or ""))
        while messages:
            if not unlimited and wave_index >= max_waves:
                deferred_reason = f"reached optional max waves ({max_waves})"
                break

            stop_reason = await _drain_stop_reason(db, task_id)
            if stop_reason is not None:
                deferred_reason = stop_reason
                break

            # Cool between waves so free-tier TPM / RPD can recover.
            if wave_index > 0 and wave_interval > 0:
                logger.info(
                    "Project tick %s cooling %ss before wave %s",
                    task_id,
                    wave_interval,
                    wave_index + 1,
                )
                await asyncio.sleep(wave_interval)
                stop_reason = await _drain_stop_reason(db, task_id)
                if stop_reason is not None:
                    deferred_reason = stop_reason
                    break

            wave_index += 1
            total_messages += len(messages)
            await update_project_batch_message_count(db, batch_id, total_messages)

            calendar_summary = await _calendar_summary(db, task_id)
            seed = build_project_seed_message(
                task=task,
                calendar_summary=calendar_summary,
                message_lines=[_compact_message_line(row) for row in messages],
                cursor=cursor,
                wave_index=wave_index,
                wave_total_hint="unlimited drain" if unlimited else f"cap {max_waves} waves",
            )
            wave_user = {"role": "user", "content": seed}
            llm_timeout = await get_config_int(db, "llm_generation_timeout")
            wave_timeout = max(int(llm_timeout) * 2, 1)
            try:
                result = await asyncio.wait_for(
                    runtime.chat(
                        [*carry_messages, wave_user],
                        session_id=session_id,
                        channel="project",
                        project_scope_task_id=task_id,
                        base_prompt=pinned_base_prompt,
                    ),
                    timeout=wave_timeout,
                )
            except asyncio.TimeoutError:
                deferred_reason = f"wave hard timeout ({wave_timeout}s)"
                wave_summaries.append(
                    f"[wave {wave_index}] stopped ({deferred_reason}); remaining backlog deferred to next schedule"
                )
                logger.warning(
                    "Project tick %s wave %s exceeded hard timeout (%ss)",
                    task_id,
                    wave_index,
                    wave_timeout,
                )
                break
            raw_sid = result.get("sessionId")
            if isinstance(raw_sid, str) and raw_sid.strip():
                session_id = raw_sid.strip()
            raw_message = result.get("message")
            agent_message = raw_message if isinstance(raw_message, str) else ""
            if agent_message.strip():
                wave_summaries.append(f"[wave {wave_index}] {agent_message.strip()}")
            tool_calls = result.get("toolCalls") or []
            if isinstance(tool_calls, list):
                all_tool_calls.extend(tool_calls)

            # Continue the same dialogue across drain waves (compacted each chat).
            carry_messages.append(wave_user)
            carry_messages.append(
                {
                    "role": "assistant",
                    "content": _wave_carry_assistant_message(
                        agent_message=agent_message,
                        tool_calls=tool_calls,
                    ),
                }
            )

            last_ts = str(messages[-1].get("timestamp") or "").strip()
            last_id = str(messages[-1].get("id") or "").strip()
            if last_ts:
                await store_project_message_cursor(
                    db,
                    task_id,
                    last_ts,
                    message_id=last_id or None,
                )
                cursor = ProjectMessageCursor(timestamp=last_ts, message_id=last_id or None)

            logger.info(
                "Project tick %s wave %s: messages=%s tools=%s session=%s",
                task_id,
                wave_index,
                len(messages),
                len(tool_calls) if isinstance(tool_calls, list) else 0,
                (session_id or "")[:8] or "-",
            )

            if len(messages) < _MESSAGE_SUMMARY_LIMIT:
                drained = True
                break
            messages = await fetch_project_messages_since(
                db,
                task_id=task_id,
                since=cursor,
                limit=_MESSAGE_SUMMARY_LIMIT,
            )

        if not drained and deferred_reason is None:
            # Queue emptied naturally after a full final wave's follow-up fetch.
            drained = not messages

        if not drained:
            if deferred_reason is None:
                deferred_reason = "backlog remains"
            remaining = await fetch_project_messages_since(
                db,
                task_id=task_id,
                since=cursor,
                limit=1,
            )
            if remaining or deferred_reason:
                wave_summaries.append(
                    f"[drain] stopped ({deferred_reason}); remaining backlog deferred to next schedule"
                )

        combined = "\n".join(wave_summaries) if wave_summaries else "project tick completed"
        await _complete_batch(
            db,
            batch_id,
            agent_message=combined,
            tool_calls=all_tool_calls,
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
    "build_project_seed_message",
    "execute_project_tick",
    "serialize_tick_tool_calls",
]

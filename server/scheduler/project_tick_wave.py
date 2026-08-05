"""Single-wave helpers for closed-loop project ticks."""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from typing import Any

from server.agent.runtime import AgentRuntime
from server.calendar.query import query_upcoming
from server.calendar.timeline_dismissals import active_timeline_items
from server.config import get_config_int
from server.db.database import Database
from server.domain.analysis_modes import CHILD_RECURRING_MODE
from server.queries.project_tick_queries import (
    ProjectMessageCursor,
    fetch_project_calendar_children,
    store_project_message_cursor,
)
from server.scheduler.project_tick import build_project_seed_message

logger = logging.getLogger(__name__)

_CONTENT_TRUNCATE = 280


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


@dataclass
class _WaveOutcome:
    agent_message: str
    tool_calls: list[Any]
    session_id: str | None
    cursor: ProjectMessageCursor | str | None
    timed_out: bool = False
    timeout_reason: str | None = None


async def _run_one_wave(
    *,
    db: Database,
    runtime: AgentRuntime,
    task: dict[str, Any],
    task_id: str,
    messages: list[dict[str, Any]],
    cursor: ProjectMessageCursor | str | None,
    wave_index: int,
    wave_total_hint: str,
    pinned_base_prompt: str,
    carry_messages: list[dict[str, str]],
    session_id: str | None,
) -> _WaveOutcome:
    """Execute one LLM wave; advance the message cursor only after success."""
    calendar_summary = await _calendar_summary(db, task_id)
    seed = build_project_seed_message(
        task=task,
        calendar_summary=calendar_summary,
        message_lines=[_compact_message_line(row) for row in messages],
        cursor=cursor,
        wave_index=wave_index,
        wave_total_hint=wave_total_hint,
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
        reason = f"wave hard timeout ({wave_timeout}s)"
        logger.warning(
            "Project tick %s wave %s exceeded hard timeout (%ss)",
            task_id,
            wave_index,
            wave_timeout,
        )
        return _WaveOutcome(
            agent_message="",
            tool_calls=[],
            session_id=session_id,
            cursor=cursor,
            timed_out=True,
            timeout_reason=reason,
        )

    raw_sid = result.get("sessionId")
    next_sid = session_id
    if isinstance(raw_sid, str) and raw_sid.strip():
        next_sid = raw_sid.strip()
    raw_message = result.get("message")
    agent_message = raw_message if isinstance(raw_message, str) else ""
    tool_calls = result.get("toolCalls") or []
    if not isinstance(tool_calls, list):
        tool_calls = []

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

    next_cursor = cursor
    last_ts = str(messages[-1].get("timestamp") or "").strip()
    last_id = str(messages[-1].get("id") or "").strip()
    if last_ts:
        await store_project_message_cursor(
            db,
            task_id,
            last_ts,
            message_id=last_id or None,
        )
        next_cursor = ProjectMessageCursor(timestamp=last_ts, message_id=last_id or None)

    logger.info(
        "Project tick %s wave %s: messages=%s tools=%s session=%s",
        task_id,
        wave_index,
        len(messages),
        len(tool_calls),
        (next_sid or "")[:8] or "-",
    )
    return _WaveOutcome(
        agent_message=agent_message,
        tool_calls=tool_calls,
        session_id=next_sid,
        cursor=next_cursor,
    )

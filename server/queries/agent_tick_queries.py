"""Database operations for the closed-loop agent tick."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from server.db.database import Database
from server.domain.analysis_modes import AGENT_MODE
from server.queries.tasks_queries import fetch_task_channel_rows
from server.util import new_id, utc_now_iso


@dataclass(frozen=True, slots=True)
class AgentMessageCursor:
    """Incremental drain position: ISO time + optional message id (same-second tie-break)."""

    timestamp: str
    message_id: str | None = None


def parse_agent_message_cursor(raw: str | None) -> AgentMessageCursor | None:
    """Parse a bare ISO timestamp into a cursor (no message-id; used for string ``since``)."""
    text = (raw or "").strip()
    if not text:
        return None
    return AgentMessageCursor(timestamp=text, message_id=None)


def _after_cursor_sql(
    cursor: AgentMessageCursor | None,
) -> tuple[str | None, list[Any]]:
    if cursor is None:
        return None, []
    ts = cursor.timestamp
    mid = (cursor.message_id or "").strip()
    if mid:
        return (
            "(m.timestamp > ? OR (m.timestamp = ? AND m.id > ?))",
            [ts, ts, mid],
        )
    return "m.timestamp > ?", [ts]


async def load_agent_message_cursor(db: Database, task_id: str) -> AgentMessageCursor | None:
    row = await db.fetch_one(
        "SELECT last_message_at, last_message_id FROM agent_message_cursors WHERE task_id = ?",
        (task_id,),
    )
    if row is None:
        return None
    ts = str(row.get("last_message_at") or "").strip()
    if not ts:
        return None
    mid_raw = row.get("last_message_id")
    mid = str(mid_raw).strip() if mid_raw is not None else ""
    return AgentMessageCursor(timestamp=ts, message_id=mid or None)


async def store_agent_message_cursor(
    db: Database,
    task_id: str,
    timestamp: str,
    *,
    message_id: str | None = None,
) -> None:
    ts = str(timestamp).strip()
    if not ts:
        return
    mid = (str(message_id).strip() if message_id else "") or None
    await db.execute(
        "INSERT INTO agent_message_cursors (task_id, last_message_at, last_message_id) "
        "VALUES (?, ?, ?) "
        "ON CONFLICT(task_id) DO UPDATE SET "
        "last_message_at = excluded.last_message_at, "
        "last_message_id = excluded.last_message_id",
        (task_id, ts, mid),
    )


async def fetch_agent_messages_since(
    db: Database,
    *,
    task_id: str,
    since: AgentMessageCursor | str | None,
    limit: int,
) -> list[dict[str, Any]]:
    channels = await fetch_task_channel_rows(db, task_id)
    if not channels:
        return []
    clauses = ["(" + " OR ".join(["(m.platform = ? AND m.platform_id = ?)"] * len(channels)) + ")"]
    params: list[Any] = []
    for row in channels:
        params.extend([row["platform"], row["platform_id"]])
    cursor = since if isinstance(since, AgentMessageCursor) else parse_agent_message_cursor(since)
    after_sql, after_params = _after_cursor_sql(cursor)
    if after_sql:
        clauses.append(after_sql)
        params.extend(after_params)
    params.append(limit)
    where = " AND ".join(clauses)
    return await db.fetch_all(
        f"SELECT m.id, m.platform, m.platform_id, m.content, m.sender_name, m.timestamp, "
        f"c.channel_name FROM messages m "
        f"LEFT JOIN channels c ON c.platform = m.platform AND c.platform_id = m.platform_id "
        f"WHERE {where} ORDER BY m.timestamp ASC, m.id ASC LIMIT ?",
        tuple(params),
    )


async def fetch_agent_calendar_children(
    db: Database,
    task_id: str,
    child_mode: str | None = None,
) -> list[dict[str, Any]]:
    """Child recurring series owned by an agent task (``parent_task_id``)."""
    del child_mode  # series are not analysis modes; kept for call-site compat
    return await db.fetch_all(
        "SELECT id, name, rrule, is_active, dtstart AS event_start_time, "
        "is_all_day AS event_is_all_day "
        "FROM recurring_schedules "
        "WHERE parent_task_id = ? "
        "ORDER BY created_at ASC",
        (task_id,),
    )


async def ensure_agent_batch(
    db: Database,
    task: dict[str, Any],
    *,
    message_count: int,
) -> str:
    version = int(task.get("version") or 1)
    task_id = str(task["id"])
    pending = await db.fetch_one(
        "SELECT * FROM analysis_batches "
        "WHERE task_id = ? AND version = ? AND status = 'pending' "
        "ORDER BY created_at ASC LIMIT 1",
        (task_id, version),
    )
    now = utc_now_iso()
    if pending is not None:
        batch_id = str(pending["id"])
        await db.execute(
            "UPDATE analysis_batches SET status = 'processing', message_count = ?, updated_at = ? WHERE id = ?",
            (message_count, now, batch_id),
        )
        return batch_id

    batch_id = new_id()
    await db.execute(
        "INSERT INTO analysis_batches "
        "(id, task_id, version, status, message_count, created_at, updated_at) "
        "VALUES (?, ?, ?, 'processing', ?, ?, ?)",
        (batch_id, task_id, version, message_count, now, now),
    )
    return batch_id


async def update_agent_batch_message_count(
    db: Database,
    batch_id: str,
    message_count: int,
) -> None:
    await db.execute(
        "UPDATE analysis_batches SET message_count = ?, updated_at = ? WHERE id = ?",
        (message_count, utc_now_iso(), batch_id),
    )


async def complete_agent_batch(
    db: Database,
    batch_id: str,
    *,
    error_message: str | None = None,
    agent_message: str | None = None,
    tool_calls_json: str | None = None,
    message_count: int | None = None,
) -> None:
    now = utc_now_iso()
    if error_message:
        err = error_message[:2000]
        if message_count is None:
            await db.execute(
                "UPDATE analysis_batches SET status = 'completed', error_message = ?, "
                "agent_message = NULL, tool_calls_json = NULL, "
                "updated_at = ?, completed_at = ? WHERE id = ?",
                (err, now, now, batch_id),
            )
        else:
            await db.execute(
                "UPDATE analysis_batches SET status = 'completed', error_message = ?, "
                "agent_message = NULL, tool_calls_json = NULL, message_count = ?, "
                "updated_at = ?, completed_at = ? WHERE id = ?",
                (err, message_count, now, now, batch_id),
            )
        return

    tools = tool_calls_json or "[]"
    if message_count is None:
        await db.execute(
            "UPDATE analysis_batches SET status = 'completed', error_message = NULL, "
            "agent_message = ?, tool_calls_json = ?, "
            "updated_at = ?, completed_at = ? WHERE id = ?",
            (agent_message, tools, now, now, batch_id),
        )
        return
    await db.execute(
        "UPDATE analysis_batches SET status = 'completed', error_message = NULL, "
        "agent_message = ?, tool_calls_json = ?, message_count = ?, "
        "updated_at = ?, completed_at = ? WHERE id = ?",
        (agent_message, tools, message_count, now, now, batch_id),
    )


async def _agent_task_version(db: Database, task_id: str) -> int | None:
    task = await db.fetch_one(
        "SELECT version, analysis_mode FROM analysis_tasks WHERE id = ?",
        (task_id,),
    )
    if task is None:
        return None
    if str(task.get("analysis_mode") or "") != AGENT_MODE:
        return None
    return int(task.get("version") or 1)


async def fetch_agent_tick_log_rows(
    db: Database,
    *,
    task_id: str,
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Recent completed agent-tick batches for the task's current version."""
    version = await _agent_task_version(db, task_id)
    if version is None:
        return []
    capped = max(1, min(int(limit), 50))
    return await db.fetch_all(
        "SELECT id, status, message_count, error_message, agent_message, tool_calls_json, "
        "created_at, updated_at, completed_at "
        "FROM analysis_batches "
        "WHERE task_id = ? AND version = ? AND status = 'completed' "
        "ORDER BY COALESCE(completed_at, updated_at) DESC, id DESC "
        "LIMIT ?",
        (task_id, version, capped),
    )


async def fetch_agent_tick_in_flight_row(
    db: Database,
    *,
    task_id: str,
) -> dict[str, Any] | None:
    """Latest pending/processing agent-tick batch for the current version."""
    version = await _agent_task_version(db, task_id)
    if version is None:
        return None
    return await db.fetch_one(
        "SELECT id, status, message_count, created_at, updated_at "
        "FROM analysis_batches "
        "WHERE task_id = ? AND version = ? AND status IN ('pending', 'processing') "
        "ORDER BY created_at DESC, id DESC "
        "LIMIT 1",
        (task_id, version),
    )


async def count_agent_messages_since_cursor(db: Database, task_id: str) -> int:
    """How many bound-channel messages remain after the project cursor."""
    cursor = await load_agent_message_cursor(db, task_id)
    channels = await fetch_task_channel_rows(db, task_id)
    if not channels:
        return 0
    clauses = ["(" + " OR ".join(["(m.platform = ? AND m.platform_id = ?)"] * len(channels)) + ")"]
    params: list[Any] = []
    for row in channels:
        params.extend([row["platform"], row["platform_id"]])
    after_sql, after_params = _after_cursor_sql(cursor)
    if after_sql:
        clauses.append(after_sql)
        params.extend(after_params)
    where = " AND ".join(clauses)
    row = await db.fetch_one(
        f"SELECT COUNT(*) AS c FROM messages m WHERE {where}",
        tuple(params),
    )
    return int((row or {}).get("c") or 0)

"""Incremental-analysis queries: unanalyzed messages + markers (version-aware).

Semantics:
- "Unanalyzed" = in the task's channel scope, inside the time window, and no
  ``analysis_markers`` row exists for ``(message_id, task_id, version)``.
- Order is always ``timestamp ASC, id ASC`` (oldest first).
- Markers are ``INSERT OR IGNORE`` against the unique index.
- Bumping ``analysis_tasks.version`` invalidates every prior marker.
- Deleting an ``analysis_batches`` row cascades markers via
  ``ON DELETE CASCADE`` on ``analysis_markers.batch_id`` (no manual clear).
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping
from typing import Any

from server.db.database import Database
from server.util import new_id, task_value, utc_now_iso

#: Explicit column projection — no SELECT *.
MESSAGE_COLUMNS: tuple[str, ...] = (
    "id",
    "source_id",
    "platform",
    "platform_id",
    "platform_message_id",
    "sender_id",
    "sender_name",
    "content",
    "timestamp",
    "raw_data",
    "created_at",
)

#: time_range token -> SQLite datetime offset. Unknown tokens = no filter.
#: Task ``analysis_time_range`` CHECK no longer includes ``12h``／``24h`` (use
#: ``1d``／``48h``). Those tokens remain here for monitor／agent message filters.
#: Monitor／agent use canonical ``7d``／``30d`` only (no ``7days``／``30days``).
_TIME_RANGE_OFFSETS: dict[str, str] = {
    "1h": "-1 hours",
    "6h": "-6 hours",
    "12h": "-12 hours",
    "24h": "-24 hours",
    "48h": "-48 hours",
    "1d": "-1 days",
    "7d": "-7 days",
    "30d": "-30 days",
}


def time_range_condition(time_range: Any, column: str = "m.timestamp") -> tuple[str, list[Any]]:
    """SQL fragment (and params) filtering ``column`` by a time_range token.

    Returns ("", []) when no filter applies (``all`` or unknown).
    """
    if not isinstance(time_range, str):
        return "", []
    if time_range == "today":
        return f"datetime({column}) >= datetime('now', 'start of day')", []
    offset = _TIME_RANGE_OFFSETS.get(time_range)
    if offset is None:
        return "", []
    return f"datetime({column}) >= datetime('now', ?)", [offset]


def _unanalyzed_where(task: Mapping[str, Any] | Any) -> tuple[list[str], list[Any]]:
    """WHERE clauses + params shared by fetch and count unanalyzed queries."""
    task_id = task_value(task, "id")
    if task_id is None:
        raise ValueError("task must have an 'id'")
    version = int(task_value(task, "version") or 1)
    time_range = task_value(task, "analysis_time_range")

    where_clauses = ["tc.task_id = ?"]
    params: list[Any] = [task_id]

    time_sql, time_params = time_range_condition(time_range)
    if time_sql:
        where_clauses.append(time_sql)
        params.extend(time_params)

    where_clauses.append(
        "NOT EXISTS (SELECT 1 FROM analysis_markers am "
        "WHERE am.message_id = m.id AND am.task_id = ? AND am.version = ?)"
    )
    params.extend([task_id, version])
    return where_clauses, params


async def fetch_unanalyzed_messages(
    db: Database,
    task: Mapping[str, Any] | Any,
    *,
    limit_override: int | None = None,
) -> list[dict[str, Any]]:
    """Fetch a task's not-yet-analyzed messages in analysis order.

    ``limit_override`` is the scheduler's effective batch limit; ``None``
    fetches without a LIMIT clause.
    """
    limit = limit_override

    select_cols = ", ".join(f"m.{col}" for col in MESSAGE_COLUMNS)
    where_clauses, params = _unanalyzed_where(task)

    sql = (
        f"SELECT {select_cols} FROM messages m "
        "JOIN task_channels tc "
        "ON tc.platform = m.platform AND tc.platform_id = m.platform_id "
        f"WHERE {' AND '.join(where_clauses)} "
        "ORDER BY m.timestamp ASC, m.id ASC"
    )
    if limit is not None:
        sql += " LIMIT ?"
        params.append(limit)

    return await db.fetch_all(sql, tuple(params))


async def count_unanalyzed_messages(db: Database, task: Mapping[str, Any] | Any) -> int:
    """COUNT variant of :func:`fetch_unanalyzed_messages` (no limit)."""
    where_clauses, params = _unanalyzed_where(task)

    value = await db.fetch_value(
        "SELECT COUNT(*) FROM messages m "
        "JOIN task_channels tc "
        "ON tc.platform = m.platform AND tc.platform_id = m.platform_id "
        f"WHERE {' AND '.join(where_clauses)}",
        tuple(params),
    )
    return int(value or 0)


def _per_task_time_range_predicate(timestamp_col: str = "m.timestamp") -> str:
    """SQL predicate: each task's ``analysis_time_range`` filters its messages."""
    tr = "t.analysis_time_range"
    clauses = [
        f"{tr} IS NULL",
        f"{tr} = ''",
        f"{tr} = 'all'",
        f"({tr} = 'today' AND datetime({timestamp_col}) >= datetime('now', 'start of day'))",
    ]
    known_tokens = {"all", "today", ""}
    for token, offset in _TIME_RANGE_OFFSETS.items():
        known_tokens.add(token)
        clauses.append(f"({tr} = '{token}' AND datetime({timestamp_col}) >= datetime('now', '{offset}'))")
    known_sql = ", ".join(f"'{token}'" for token in sorted(known_tokens) if token)
    clauses.append(f"({tr} NOT IN ({known_sql}) AND {tr} IS NOT NULL)")
    return "(" + " OR ".join(clauses) + ")"


async def count_unanalyzed_messages_by_task(
    db: Database,
    tasks: list[Mapping[str, Any] | Any] | None = None,
) -> dict[str, int]:
    """Batch COUNT of unanalyzed messages keyed by task id (one query for all tasks)."""
    if tasks is None:
        task_rows = await db.fetch_all("SELECT id, version, analysis_time_range FROM analysis_tasks")
    else:
        task_rows = list(tasks)

    if not task_rows:
        return {}

    task_ids = [str(task_value(task, "id") or "") for task in task_rows]
    task_ids = [task_id for task_id in task_ids if task_id]
    if not task_ids:
        return {}

    time_predicate = _per_task_time_range_predicate()
    placeholders = ", ".join("?" * len(task_ids))
    rows = await db.fetch_all(
        "SELECT t.id AS task_id, COUNT(*) AS c "
        "FROM analysis_tasks t "
        "JOIN task_channels tc ON tc.task_id = t.id "
        "JOIN messages m ON m.platform = tc.platform AND m.platform_id = tc.platform_id "
        f"WHERE t.id IN ({placeholders}) AND {time_predicate} "
        "AND NOT EXISTS ("
        "SELECT 1 FROM analysis_markers am "
        "WHERE am.message_id = m.id AND am.task_id = t.id AND am.version = t.version"
        ") "
        "GROUP BY t.id",
        tuple(task_ids),
    )
    counts = {str(row["task_id"]): int(row["c"] or 0) for row in rows}
    for task in task_rows:
        task_id = str(task_value(task, "id") or "")
        if task_id and task_id not in counts:
            counts[task_id] = 0
    return counts


def marker_rows(
    batch_id: str, task_id: str, version: int, message_ids: Iterable[str]
) -> list[tuple[str, str, str, int, str, str]]:
    """Build dedup'd marker rows for an executemany INSERT OR IGNORE."""
    analyzed_at = utc_now_iso()
    seen: set[str] = set()
    rows: list[tuple[str, str, str, int, str, str]] = []
    for message_id in message_ids:
        if message_id in seen:
            continue
        seen.add(message_id)
        rows.append((new_id(), message_id, task_id, version, batch_id, analyzed_at))
    return rows


MARKER_INSERT_SQL = (
    "INSERT OR IGNORE INTO analysis_markers "
    "(id, message_id, task_id, version, batch_id, analyzed_at) "
    "VALUES (?, ?, ?, ?, ?, ?)"
)

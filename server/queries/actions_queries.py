"""Database queries backing actions CRUD and trigger-history listing."""

from __future__ import annotations

from typing import Any

from server.queries.pagination import fetch_offset_page


async def fetch_all_action_rows(db: Any) -> list[dict[str, Any]]:
    return await db.fetch_all("SELECT * FROM actions ORDER BY created_at ASC")


async def fetch_trigger_history_page(
    db: Any,
    *,
    action_id: str | None,
    limit: int,
    offset: int,
) -> tuple[list[dict[str, Any]], int, bool]:
    clauses: list[str] = []
    params: list[Any] = []
    if action_id:
        clauses.append("action_id = ?")
        params.append(action_id)
    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    return await fetch_offset_page(
        db,
        count_sql=f"SELECT COUNT(*) FROM action_trigger_history {where_sql}",
        select_sql=(f"SELECT * FROM action_trigger_history {where_sql} ORDER BY datetime(triggered_at) DESC, id DESC"),
        params=params,
        limit=limit,
        offset=offset,
    )


async def insert_action(
    db: Any,
    *,
    action_id: str,
    name: str,
    action_type: str,
    configuration: str,
    trigger_conditions: str | None,
    now: str,
) -> None:
    await db.execute(
        "INSERT INTO actions (id, name, action_type, configuration, "
        "trigger_conditions, is_enabled, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, 1, ?, ?)",
        (action_id, name, action_type, configuration, trigger_conditions, now, now),
    )


async def update_action(
    db: Any,
    *,
    action_id: str,
    name: str,
    action_type: str,
    configuration: str,
    trigger_conditions: str | None,
    now: str,
) -> None:
    await db.execute(
        "UPDATE actions SET name = ?, action_type = ?, configuration = ?, "
        "trigger_conditions = ?, updated_at = ? WHERE id = ?",
        (name, action_type, configuration, trigger_conditions, now, action_id),
    )


async def delete_action(db: Any, action_id: str) -> None:
    await db.execute("DELETE FROM actions WHERE id = ?", (action_id,))


async def set_action_enabled(db: Any, action_id: str, is_enabled: int, now: str) -> None:
    await db.execute(
        "UPDATE actions SET is_enabled = ?, updated_at = ? WHERE id = ?",
        (is_enabled, now, action_id),
    )

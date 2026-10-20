"""Write SQL for user-authored events. Normalization stays in ``user_events_normalize``."""

from __future__ import annotations

from typing import Any

from server.db.database import Database, TransactionDb


async def fetch_analysis_task_workset_value(db: Any, task_id: str) -> Any:
    """Raw ``analysis_tasks.workset_id``, or None when the task row is missing."""
    row = await db.fetch_one(
        "SELECT workset_id FROM analysis_tasks WHERE id = ?",
        (task_id,),
    )
    if row is None:
        return None
    return row.get("workset_id")


async def insert_user_event(
    db: Database,
    *,
    event_id: str,
    title: str,
    body: str,
    start_time: str,
    end_time: str | None,
    location: str,
    origin: str,
    is_all_day: bool,
    remind_before_days: int | None,
    task_id: str | None,
    item_id: str | None,
    workset_id: str,
    kind: str,
    amount: float | None,
    direction: str | None,
    notify_pref: str,
    emoji: str | None,
    now: str,
) -> None:
    await db.execute(
        "INSERT INTO user_events "
        "(id, title, body, start_time, end_time, location, origin, event_is_all_day, "
        "remind_before_days, task_id, item_id, workset_id, kind, amount, direction, "
        "notify_pref, emoji, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            event_id,
            title,
            body,
            start_time,
            end_time,
            location,
            origin,
            1 if is_all_day else 0,
            remind_before_days,
            task_id,
            item_id,
            workset_id,
            kind,
            amount,
            direction,
            notify_pref,
            emoji,
            now,
            now,
        ),
    )


async def update_user_event_row(
    db: Database,
    event_id: str,
    *,
    title: str,
    body: str,
    start_time: str,
    end_time: str | None,
    location: str,
    is_all_day: bool,
    remind_before_days: int | None,
    task_id: str | None,
    item_id: str | None,
    workset_id: str,
    kind: str,
    amount: float | None,
    direction: str | None,
    notify_pref: str,
    emoji: str | None,
    now: str,
) -> None:
    await db.execute(
        "UPDATE user_events SET title = ?, body = ?, start_time = ?, end_time = ?, "
        "location = ?, event_is_all_day = ?, remind_before_days = ?, task_id = ?, item_id = ?, "
        "workset_id = ?, kind = ?, amount = ?, direction = ?, notify_pref = ?, emoji = ?, updated_at = ? "
        "WHERE id = ?",
        (
            title,
            body,
            start_time,
            end_time,
            location,
            1 if is_all_day else 0,
            remind_before_days,
            task_id,
            item_id,
            workset_id,
            kind,
            amount,
            direction,
            notify_pref,
            emoji,
            now,
            event_id,
        ),
    )


async def delete_user_event_row(db: Database, event_id: str) -> None:
    """Hard-delete the event and its user-source timeline markers in one transaction."""
    async with db.transaction() as conn:
        tx = TransactionDb(conn)
        await tx.execute(
            "DELETE FROM timeline_dismissals WHERE source = 'user' AND event_id = ?",
            (event_id,),
        )
        await tx.execute(
            "DELETE FROM timeline_importance WHERE source = 'user' AND event_id = ?",
            (event_id,),
        )
        await tx.execute("DELETE FROM user_events WHERE id = ?", (event_id,))

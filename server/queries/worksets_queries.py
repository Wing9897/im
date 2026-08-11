"""Database queries backing worksets endpoints."""

from __future__ import annotations

from typing import Any

from server.db.database import TransactionDb
from server.worksets_const import SYSTEM_WORKSET_ID


async def fetch_all_workset_rows(db: Any) -> list[dict[str, Any]]:
    # System workset first, then creation order.
    return await db.fetch_all("SELECT * FROM worksets ORDER BY is_system DESC, created_at ASC")


async def fetch_workset_row(db: Any, workset_id: str) -> dict[str, Any] | None:
    return await db.fetch_one("SELECT * FROM worksets WHERE id = ?", (workset_id,))


async def insert_workset(
    tx: TransactionDb,
    *,
    workset_id: str,
    name: str,
    now: str,
    is_system: bool = False,
) -> None:
    await tx.execute(
        "INSERT INTO worksets (id, name, is_system, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (workset_id, name, 1 if is_system else 0, now, now),
    )


async def update_workset(
    tx: TransactionDb,
    *,
    workset_id: str,
    name: str,
    now: str,
) -> None:
    await tx.execute(
        "UPDATE worksets SET name = ?, updated_at = ? WHERE id = ?",
        (name, now, workset_id),
    )


async def delete_workset(tx: TransactionDb, workset_id: str) -> None:
    # analysis_tasks.workset_id remains ON DELETE SET NULL.
    # user_events / items / recurring_schedules.workset_id are NOT NULL — reassign first.
    await tx.execute(
        "UPDATE user_events SET workset_id = ? WHERE workset_id = ?",
        (SYSTEM_WORKSET_ID, workset_id),
    )
    await tx.execute(
        "UPDATE items SET workset_id = ? WHERE workset_id = ?",
        (SYSTEM_WORKSET_ID, workset_id),
    )
    await tx.execute(
        "UPDATE recurring_schedules SET workset_id = ? WHERE workset_id = ?",
        (SYSTEM_WORKSET_ID, workset_id),
    )
    await tx.execute("DELETE FROM worksets WHERE id = ?", (workset_id,))


async def workset_exists(db: Any, workset_id: str) -> bool:
    row = await db.fetch_one("SELECT 1 AS ok FROM worksets WHERE id = ?", (workset_id,))
    return row is not None


async def workset_is_system(db: Any, workset_id: str) -> bool:
    row = await db.fetch_one("SELECT is_system FROM worksets WHERE id = ?", (workset_id,))
    if row is None:
        return workset_id == SYSTEM_WORKSET_ID
    return bool(row.get("is_system"))

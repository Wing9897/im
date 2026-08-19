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
    notify_enabled: bool = True,
    external_enabled: bool = True,
) -> None:
    await tx.execute(
        "INSERT INTO worksets (id, name, is_system, notify_enabled, external_enabled, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (
            workset_id,
            name,
            1 if is_system else 0,
            1 if notify_enabled else 0,
            1 if external_enabled else 0,
            now,
            now,
        ),
    )


async def update_workset(
    tx: TransactionDb,
    *,
    workset_id: str,
    name: str,
    now: str,
    notify_enabled: bool | None = None,
    external_enabled: bool | None = None,
) -> None:
    assignments = ["name = ?"]
    params: list[Any] = [name]
    if notify_enabled is not None:
        assignments.append("notify_enabled = ?")
        params.append(1 if notify_enabled else 0)
    if external_enabled is not None:
        assignments.append("external_enabled = ?")
        params.append(1 if external_enabled else 0)
    assignments.append("updated_at = ?")
    params.append(now)
    params.append(workset_id)
    await tx.execute(
        f"UPDATE worksets SET {', '.join(assignments)} WHERE id = ?",
        tuple(params),
    )


async def delete_workset(tx: TransactionDb, workset_id: str) -> None:
    # analysis_tasks / user_events / items / recurring_schedules.workset_id are
    # NOT NULL — reassign to __general__ before deleting the row.
    await tx.execute(
        "UPDATE analysis_tasks SET workset_id = ? WHERE workset_id = ?",
        (SYSTEM_WORKSET_ID, workset_id),
    )
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


async def fetch_external_enabled_workset_ids(db: Any) -> frozenset[str]:
    rows = await db.fetch_all("SELECT id FROM worksets WHERE external_enabled = 1")
    return frozenset(str(row["id"]) for row in rows)


async def workset_exists(db: Any, workset_id: str) -> bool:
    row = await db.fetch_one("SELECT 1 AS ok FROM worksets WHERE id = ?", (workset_id,))
    return row is not None


async def workset_is_system(db: Any, workset_id: str) -> bool:
    row = await db.fetch_one("SELECT is_system FROM worksets WHERE id = ?", (workset_id,))
    if row is None:
        return workset_id == SYSTEM_WORKSET_ID
    return bool(row.get("is_system"))

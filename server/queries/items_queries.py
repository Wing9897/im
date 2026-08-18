"""Database queries for item_categories and items.

Item expiry / remind-before are **derived on read** from the primary linked
``user_events`` row with ``kind=expires`` (non-dismissed, earliest
``created_at``). There are no denormalized ``items.expires_at`` /
``items.remind_before_days`` columns.
"""

from __future__ import annotations

from typing import Any

from server.calendar.user_event_kinds import USER_EVENT_KIND_EXPIRES
from server.db.database import TransactionDb
from server.domain.workset_scope import bind_workset_ids_sql

# Correlated subquery: primary active linked expires calendar for an item.
_PRIMARY_EXPIRES_EVENT_ID_SQL = f"""(
  SELECT ue.id
  FROM user_events ue
  LEFT JOIN timeline_dismissals td
    ON td.source = 'user' AND td.event_id = ue.id
  WHERE ue.item_id = i.id
    AND ue.kind = '{USER_EVENT_KIND_EXPIRES}'
    AND td.event_id IS NULL
  ORDER BY ue.created_at ASC, ue.id ASC
  LIMIT 1
)"""

# SELECT list that aliases derived dates as expires_at / remind_before_days
# so serializers keep reading those keys.
_ITEMS_WITH_DERIVED_DATES_SELECT = f"""
SELECT
  i.*,
  CASE
    WHEN pe.start_time IS NULL THEN NULL
    ELSE substr(pe.start_time, 1, 10)
  END AS expires_at,
  pe.remind_before_days AS remind_before_days,
  pe.notify_pref AS notify_pref
FROM items i
LEFT JOIN user_events pe ON pe.id = {_PRIMARY_EXPIRES_EVENT_ID_SQL}
"""


async def fetch_all_category_rows(db: Any) -> list[dict[str, Any]]:
    return await db.fetch_all("SELECT * FROM item_categories ORDER BY sort_order ASC, name ASC, id ASC")


async def fetch_category_row(db: Any, category_id: str) -> dict[str, Any] | None:
    return await db.fetch_one("SELECT * FROM item_categories WHERE id = ?", (category_id,))


async def fetch_category_by_slug(db: Any, slug: str) -> dict[str, Any] | None:
    return await db.fetch_one("SELECT * FROM item_categories WHERE slug = ?", (slug,))


async def insert_category(
    tx: TransactionDb,
    *,
    category_id: str,
    name: str,
    slug: str | None,
    sort_order: int,
    color: str | None,
    emoji: str | None,
    default_remind_before_days: int | None,
    now: str,
) -> None:
    await tx.execute(
        "INSERT INTO item_categories ("
        "id, name, slug, sort_order, color, emoji, default_remind_before_days, "
        "created_at, updated_at"
        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            category_id,
            name,
            slug,
            sort_order,
            color,
            emoji,
            default_remind_before_days,
            now,
            now,
        ),
    )


async def update_category(
    tx: TransactionDb,
    *,
    category_id: str,
    name: str,
    slug: str | None,
    sort_order: int,
    color: str | None,
    emoji: str | None,
    default_remind_before_days: int | None,
    now: str,
) -> None:
    await tx.execute(
        "UPDATE item_categories SET name = ?, slug = ?, sort_order = ?, color = ?, "
        "emoji = ?, default_remind_before_days = ?, updated_at = ? WHERE id = ?",
        (
            name,
            slug,
            sort_order,
            color,
            emoji,
            default_remind_before_days,
            now,
            category_id,
        ),
    )


async def delete_category(tx: TransactionDb, category_id: str) -> None:
    # items.category_id is ON DELETE SET NULL — explicit clear for clarity.
    await tx.execute("UPDATE items SET category_id = NULL WHERE category_id = ?", (category_id,))
    await tx.execute("DELETE FROM item_categories WHERE id = ?", (category_id,))


async def fetch_item_row(db: Any, item_id: str) -> dict[str, Any] | None:
    return await db.fetch_one(
        f"{_ITEMS_WITH_DERIVED_DATES_SELECT} WHERE i.id = ?",
        (item_id,),
    )


async def fetch_item_rows(
    db: Any,
    *,
    workset_id: str | None = None,
    category_id: str | None = None,
    status: str | None = None,
    search: str | None = None,
    workset_ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    clauses: list[str] = []
    params: list[Any] = []
    if workset_id is not None:
        clauses.append("i.workset_id = ?")
        params.append(workset_id)
    workset_sql, workset_params = bind_workset_ids_sql("i.workset_id", workset_ids)
    if workset_sql:
        clauses.append(workset_sql)
        params.extend(workset_params)
    if category_id is not None:
        if category_id == "":
            clauses.append("i.category_id IS NULL")
        else:
            clauses.append("i.category_id = ?")
            params.append(category_id)
    if status is not None:
        clauses.append("i.status = ?")
        params.append(status)
    if search and search.strip():
        needle = f"%{search.strip().lower()}%"
        clauses.append(
            "(LOWER(i.title) LIKE ? OR LOWER(i.notes) LIKE ? OR LOWER(i.unit) LIKE ? "
            "OR CAST(i.quantity AS TEXT) LIKE ?)"
        )
        params.extend([needle, needle, needle, needle])
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    return await db.fetch_all(
        f"{_ITEMS_WITH_DERIVED_DATES_SELECT} {where} ORDER BY "
        "CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END, expires_at ASC, i.updated_at DESC",
        tuple(params),
    )


async def fetch_active_items_with_dates(
    db: Any,
    *,
    range_start_date: str,
    range_end_date: str,
    workset_id: str | None = None,
) -> list[dict[str, Any]]:
    """Active items whose derived expiry/remind DATE falls in [start, end].

    Remind day is ``date(expires_at, '-' || remind_before_days || ' days')`` when
    ``remind_before_days > 0``.
    """
    clauses = [
        "i.status = 'active'",
        "("
        "(expires_at IS NOT NULL AND expires_at >= ? AND expires_at <= ?) "
        "OR ("
        "expires_at IS NOT NULL AND remind_before_days IS NOT NULL "
        "AND remind_before_days > 0 "
        "AND date(expires_at, '-' || remind_before_days || ' days') >= ? "
        "AND date(expires_at, '-' || remind_before_days || ' days') <= ?"
        ")"
        ")",
    ]
    params: list[Any] = [
        range_start_date,
        range_end_date,
        range_start_date,
        range_end_date,
    ]
    if workset_id is not None:
        clauses.append("i.workset_id = ?")
        params.append(workset_id)
    where = " AND ".join(clauses)
    return await db.fetch_all(
        f"{_ITEMS_WITH_DERIVED_DATES_SELECT} WHERE {where}",
        tuple(params),
    )


async def fetch_expiring_items(
    db: Any,
    *,
    today: str,
    until: str,
    workset_id: str | None = None,
    include_overdue: bool = True,
    limit: int = 50,
    workset_ids: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Active items with derived expires_at in window (and optionally overdue before today)."""
    if include_overdue:
        clauses = ["i.status = 'active'", "expires_at IS NOT NULL", "expires_at <= ?"]
        params: list[Any] = [until]
    else:
        clauses = [
            "i.status = 'active'",
            "expires_at IS NOT NULL",
            "expires_at >= ?",
            "expires_at <= ?",
        ]
        params = [today, until]
    if workset_id is not None:
        clauses.append("i.workset_id = ?")
        params.append(workset_id)
    workset_sql, workset_params = bind_workset_ids_sql("i.workset_id", workset_ids)
    if workset_sql:
        clauses.append(workset_sql)
        params.extend(workset_params)
    where = " AND ".join(clauses)
    return await db.fetch_all(
        f"{_ITEMS_WITH_DERIVED_DATES_SELECT} WHERE {where} ORDER BY expires_at ASC LIMIT ?",
        (*params, limit),
    )


async def insert_item(
    tx: TransactionDb,
    *,
    item_id: str,
    title: str,
    category_id: str | None,
    workset_id: str,
    notes: str,
    status: str,
    emoji: str | None,
    quantity: float | None,
    unit: str | None,
    now: str,
) -> None:
    await tx.execute(
        "INSERT INTO items ("
        "id, title, category_id, workset_id, notes, status, emoji, quantity, unit, "
        "created_at, updated_at"
        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            item_id,
            title,
            category_id,
            workset_id,
            notes,
            status,
            emoji,
            quantity,
            unit,
            now,
            now,
        ),
    )


async def update_item(
    tx: TransactionDb,
    *,
    item_id: str,
    title: str,
    category_id: str | None,
    workset_id: str,
    notes: str,
    status: str,
    emoji: str | None,
    quantity: float | None,
    unit: str | None,
    now: str,
) -> None:
    await tx.execute(
        "UPDATE items SET title = ?, category_id = ?, workset_id = ?, "
        "notes = ?, status = ?, emoji = ?, "
        "quantity = ?, unit = ?, updated_at = ? WHERE id = ?",
        (
            title,
            category_id,
            workset_id,
            notes,
            status,
            emoji,
            quantity,
            unit,
            now,
            item_id,
        ),
    )


async def delete_item(tx: TransactionDb, item_id: str) -> None:
    await tx.execute("DELETE FROM items WHERE id = ?", (item_id,))


async def sync_linked_calendars_workset(
    tx: TransactionDb,
    *,
    item_id: str,
    workset_id: str,
) -> None:
    """Propagate item workset to linked one-off events and recurring series."""
    await tx.execute(
        "UPDATE user_events SET workset_id = ? WHERE item_id = ?",
        (workset_id, item_id),
    )
    await tx.execute(
        "UPDATE recurring_schedules SET workset_id = ? WHERE item_id = ?",
        (workset_id, item_id),
    )

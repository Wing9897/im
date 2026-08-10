"""Database queries for item_categories and items."""

from __future__ import annotations

from typing import Any

from server.db.database import TransactionDb


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
    field_schema: str,
    default_remind_before_days: int | None,
    now: str,
) -> None:
    await tx.execute(
        "INSERT INTO item_categories ("
        "id, name, slug, sort_order, color, emoji, field_schema, default_remind_before_days, "
        "created_at, updated_at"
        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            category_id,
            name,
            slug,
            sort_order,
            color,
            emoji,
            field_schema,
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
    field_schema: str,
    default_remind_before_days: int | None,
    now: str,
) -> None:
    await tx.execute(
        "UPDATE item_categories SET name = ?, slug = ?, sort_order = ?, color = ?, "
        "emoji = ?, field_schema = ?, default_remind_before_days = ?, updated_at = ? WHERE id = ?",
        (
            name,
            slug,
            sort_order,
            color,
            emoji,
            field_schema,
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
    return await db.fetch_one("SELECT * FROM items WHERE id = ?", (item_id,))


async def fetch_item_rows(
    db: Any,
    *,
    workset_id: str | None = None,
    category_id: str | None = None,
    status: str | None = None,
    search: str | None = None,
) -> list[dict[str, Any]]:
    clauses: list[str] = []
    params: list[Any] = []
    if workset_id is not None:
        clauses.append("workset_id = ?")
        params.append(workset_id)
    if category_id is not None:
        if category_id == "":
            clauses.append("category_id IS NULL")
        else:
            clauses.append("category_id = ?")
            params.append(category_id)
    if status is not None:
        clauses.append("status = ?")
        params.append(status)
    if search and search.strip():
        needle = f"%{search.strip().lower()}%"
        clauses.append(
            "("
            "LOWER(title) LIKE ? OR LOWER(notes) LIKE ? OR LOWER(attributes_json) LIKE ? "
            "OR LOWER(unit) LIKE ? OR CAST(quantity AS TEXT) LIKE ?"
            ")"
        )
        params.extend([needle, needle, needle, needle, needle])
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    return await db.fetch_all(
        f"SELECT * FROM items {where} ORDER BY "
        "CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END, expires_at ASC, updated_at DESC",
        tuple(params),
    )


async def fetch_active_items_with_dates(
    db: Any,
    *,
    range_start_date: str,
    range_end_date: str,
    workset_id: str | None = None,
) -> list[dict[str, Any]]:
    """Active items with expiry/remind DATE falling in [start, end].

    Remind day is ``date(expires_at, '-' || remind_before_days || ' days')`` when
    ``remind_before_days > 0``.
    """
    clauses = [
        "status = 'active'",
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
        clauses.append("workset_id = ?")
        params.append(workset_id)
    where = " AND ".join(clauses)
    return await db.fetch_all(f"SELECT * FROM items WHERE {where}", tuple(params))


async def fetch_expiring_items(
    db: Any,
    *,
    today: str,
    until: str,
    workset_id: str | None = None,
    include_overdue: bool = True,
    limit: int = 50,
) -> list[dict[str, Any]]:
    """Active items with expires_at in window (and optionally overdue before today)."""
    if include_overdue:
        clauses = ["status = 'active'", "expires_at IS NOT NULL", "expires_at <= ?"]
        params: list[Any] = [until]
    else:
        clauses = [
            "status = 'active'",
            "expires_at IS NOT NULL",
            "expires_at >= ?",
            "expires_at <= ?",
        ]
        params = [today, until]
    if workset_id is not None:
        clauses.append("workset_id = ?")
        params.append(workset_id)
    where = " AND ".join(clauses)
    return await db.fetch_all(
        f"SELECT * FROM items WHERE {where} ORDER BY expires_at ASC LIMIT ?",
        (*params, limit),
    )


async def insert_item(
    tx: TransactionDb,
    *,
    item_id: str,
    title: str,
    category_id: str | None,
    workset_id: str,
    expires_at: str | None,
    remind_before_days: int | None,
    notes: str,
    status: str,
    emoji: str | None,
    quantity: float | None,
    unit: str | None,
    attributes_json: str,
    now: str,
) -> None:
    await tx.execute(
        "INSERT INTO items ("
        "id, title, category_id, workset_id, expires_at, "
        "remind_before_days, notes, status, emoji, quantity, unit, "
        "attributes_json, created_at, updated_at"
        ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            item_id,
            title,
            category_id,
            workset_id,
            expires_at,
            remind_before_days,
            notes,
            status,
            emoji,
            quantity,
            unit,
            attributes_json,
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
    expires_at: str | None,
    remind_before_days: int | None,
    notes: str,
    status: str,
    emoji: str | None,
    quantity: float | None,
    unit: str | None,
    attributes_json: str,
    now: str,
) -> None:
    await tx.execute(
        "UPDATE items SET title = ?, category_id = ?, workset_id = ?, "
        "expires_at = ?, remind_before_days = ?, notes = ?, status = ?, emoji = ?, "
        "quantity = ?, unit = ?, attributes_json = ?, updated_at = ? WHERE id = ?",
        (
            title,
            category_id,
            workset_id,
            expires_at,
            remind_before_days,
            notes,
            status,
            emoji,
            quantity,
            unit,
            attributes_json,
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
    """Propagate item workset to linked one-off events and recurring task calendars."""
    await tx.execute(
        "UPDATE user_events SET workset_id = ? WHERE item_id = ?",
        (workset_id, item_id),
    )
    await tx.execute(
        """
        UPDATE analysis_tasks
        SET workset_id = ?
        WHERE id IN (SELECT task_id FROM recurring_schedules WHERE item_id = ?)
        """,
        (workset_id, item_id),
    )

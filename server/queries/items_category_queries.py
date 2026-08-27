"""Database queries for item_categories."""

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

"""Direct DB seed helpers for items domain tests."""

from __future__ import annotations

from server.db.database import Database, TransactionDb
from server.queries.items_queries import insert_item
from server.util import new_id, utc_now_iso
from server.worksets_const import SYSTEM_WORKSET_ID


async def seed_item_row(
    db: Database,
    *,
    item_id: str | None = None,
    title: str = "test item",
    category_id: str | None = None,
    workset_id: str = SYSTEM_WORKSET_ID,
    expires_at: str | None = None,
    remind_before_days: int | None = None,
    notes: str = "",
    status: str = "active",
    emoji: str | None = None,
    quantity: float | None = None,
    unit: str | None = None,
    attributes_json: str = "{}",
) -> str:
    """Insert an item row bypassing HTTP — for cache-column / reconcile tests."""
    resolved_id = item_id or new_id()
    now = utc_now_iso()
    async with db.transaction() as conn:
        await insert_item(
            TransactionDb(conn),
            item_id=resolved_id,
            title=title,
            category_id=category_id,
            workset_id=workset_id,
            expires_at=expires_at,
            remind_before_days=remind_before_days,
            notes=notes,
            status=status,
            emoji=emoji,
            quantity=quantity,
            unit=unit,
            attributes_json=attributes_json,
            now=now,
        )
    return resolved_id

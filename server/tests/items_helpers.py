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
    notes: str = "",
    status: str = "active",
    emoji: str | None = None,
    quantity: float | None = None,
    unit: str | None = None,
) -> str:
    """Insert an item row bypassing HTTP."""
    resolved_id = item_id or new_id()
    now = utc_now_iso()
    async with db.transaction() as conn:
        await insert_item(
            TransactionDb(conn),
            item_id=resolved_id,
            title=title,
            category_id=category_id,
            workset_id=workset_id,
            notes=notes,
            status=status,
            emoji=emoji,
            quantity=quantity,
            unit=unit,
            now=now,
        )
    return resolved_id

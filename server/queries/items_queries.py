"""Database queries for item_categories and items.

Item expiry / remind-before are **derived on read** from the primary linked
``user_events`` row with ``kind=expires`` (non-dismissed, earliest
``created_at``). There are no denormalized ``items.expires_at`` /
``items.remind_before_days`` columns.

Category SQL lives in ``items_category_queries``; item SQL in
``items_item_queries``. This module re-exports the public surface.
"""

from __future__ import annotations

from server.queries.items_category_queries import (
    delete_category,
    fetch_all_category_rows,
    fetch_category_by_slug,
    fetch_category_row,
    insert_category,
    update_category,
)
from server.queries.items_item_queries import (
    delete_item,
    fetch_active_items_with_dates,
    fetch_expiring_items,
    fetch_item_row,
    fetch_item_rows,
    insert_item,
    sync_linked_calendars_workset,
    update_item,
)

__all__ = [
    "delete_category",
    "delete_item",
    "fetch_active_items_with_dates",
    "fetch_all_category_rows",
    "fetch_category_by_slug",
    "fetch_category_row",
    "fetch_expiring_items",
    "fetch_item_row",
    "fetch_item_rows",
    "insert_category",
    "insert_item",
    "sync_linked_calendars_workset",
    "update_category",
    "update_item",
]

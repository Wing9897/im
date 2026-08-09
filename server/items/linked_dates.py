"""Align item expires_at / remind_before_days with linked expiry calendars.

Items API no longer accepts expiry / remind writes. Linked ``user_events``
titled 到期 / Expires are the source of truth. Item columns are a denormalized
cache for list badges, sort, agent ``list_expiring``, and remind projection —
never a standalone SoT.

Write-through: calendar create / update / delete calls
``sync_item_dates_from_linked_calendars``. GET list/get must not reconcile.
"""

from __future__ import annotations

from typing import Any, Mapping

from server.db.database import Database
from server.util import utc_now_iso

#: Titles used by Items quick-create「到期」chip (en / zh-Hans / zh-Hant).
LINKED_EXPIRY_TITLES = frozenset({"到期", "Expires"})


def is_linked_expiry_title(title: str | None) -> bool:
    return str(title or "").strip() in LINKED_EXPIRY_TITLES


class LinkedExpiryConflictError(ValueError):
    """Item already has an active linked expiry calendar."""


async def assert_no_duplicate_linked_expiry(
    db: Database,
    item_id: str,
    *,
    exclude_event_id: str | None = None,
) -> None:
    """Reject a second active linked「到期」/ Expires on the same item."""
    clean_id = (item_id or "").strip()
    if not clean_id:
        return
    rows = await _active_linked_expiry_rows(db, clean_id)
    if exclude_event_id:
        rows = [row for row in rows if str(row.get("id") or "") != exclude_event_id]
    if rows:
        raise LinkedExpiryConflictError(
            "item already has an active linked expiry calendar (到期 / Expires)"
        )


def _date_prefix(raw: Any) -> str | None:
    if not isinstance(raw, str):
        return None
    text = raw.strip()
    if len(text) >= 10 and text[4] == "-" and text[7] == "-":
        return text[:10]
    return None


async def _active_linked_expiry_rows(
    db: Database,
    item_id: str,
) -> list[dict[str, Any]]:
    """Non-dismissed linked user_events whose title is an expiry milestone."""
    rows = await db.fetch_all(
        """
        SELECT ue.*
        FROM user_events ue
        LEFT JOIN timeline_dismissals td
          ON td.source = 'user' AND td.event_id = ue.id
        WHERE ue.item_id = ?
          AND ue.title IN (?, ?)
          AND td.event_id IS NULL
        ORDER BY ue.start_time ASC, ue.id ASC
        """,
        (item_id, "到期", "Expires"),
    )
    return list(rows)


def _earliest_day(rows: list[Mapping[str, Any]]) -> str | None:
    for row in rows:
        day = _date_prefix(row.get("start_time"))
        if day:
            return day
    return None


async def sync_item_dates_from_linked_calendars(
    db: Database,
    item_id: str,
) -> None:
    """Write denormalized expiry cache from active linked「到期」milestones."""
    clean_id = (item_id or "").strip()
    if not clean_id:
        return
    existing = await db.fetch_one("SELECT id FROM items WHERE id = ?", (clean_id,))
    if existing is None:
        return

    expiry_rows = await _active_linked_expiry_rows(db, clean_id)
    expires_at = _earliest_day(expiry_rows)
    remind_before_days = None
    if expiry_rows:
        raw_remind = expiry_rows[0].get("remind_before_days")
        if raw_remind is not None:
            try:
                remind_before_days = int(raw_remind)
            except (TypeError, ValueError):
                remind_before_days = None

    await db.execute(
        "UPDATE items SET expires_at = ?, remind_before_days = ?, updated_at = ? WHERE id = ?",
        (
            expires_at if isinstance(expires_at, str) or expires_at is None else str(expires_at),
            remind_before_days,
            utc_now_iso(),
            clean_id,
        ),
    )


async def reconcile_item_linked_dates(db: Database, item_id: str) -> bool:
    """Refresh denormalized expiry cache from linked calendars (mutation / seed helpers).

    Not used by GET list/get. Returns True when the item row exists and was synced.
    """
    clean_id = (item_id or "").strip()
    if not clean_id:
        return False
    existing = await db.fetch_one("SELECT id FROM items WHERE id = ?", (clean_id,))
    if existing is None:
        return False
    await sync_item_dates_from_linked_calendars(db, clean_id)
    return True

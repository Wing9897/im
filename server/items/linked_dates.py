"""Align item expires_at / remind_before_days with linked expiry calendars.

Items API no longer accepts expiry / remind writes. Linked ``user_events`` with
``kind=expires`` (timeline ``source=user`` + ``item_id``) are the source of
truth (title presets 到期 / Expires are UX only). Item columns are a
denormalized cache for list badges, sort, agent ``list_expiring``, and the
separate timeline ``source=item`` remind projection — never a standalone SoT.

Do not confuse item-linked user events (``kind`` authority) with ``source=item``
remind rows. See ``server.calendar.user_event_kinds`` for the calendar hierarchy.

Write-through: calendar create / update / delete calls
``sync_item_dates_from_linked_calendars``. GET list/get must not reconcile.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any, Mapping

from server.calendar.user_event_kinds import USER_EVENT_KIND_EXPIRES
from server.db.database import Database
from server.util import utc_now_iso

__all__ = [
    "is_linked_expiry_kind",
    "sync_item_dates_from_linked_calendars",
    "reconcile_item_linked_dates",
]


def is_linked_expiry_kind(kind: str | None) -> bool:
    return str(kind or "").strip() == USER_EVENT_KIND_EXPIRES


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
    """Non-dismissed linked user_events with ``kind=expires`` (primary = earliest created_at)."""
    rows = await db.fetch_all(
        """
        SELECT ue.*
        FROM user_events ue
        LEFT JOIN timeline_dismissals td
          ON td.source = 'user' AND td.event_id = ue.id
        WHERE ue.item_id = ?
          AND ue.kind = ?
          AND td.event_id IS NULL
        ORDER BY ue.created_at ASC, ue.id ASC
        """,
        (item_id, USER_EVENT_KIND_EXPIRES),
    )
    return list(rows)


def _primary_expiry_day(rows: Sequence[Mapping[str, Any]]) -> str | None:
    if not rows:
        return None
    return _date_prefix(rows[0].get("start_time"))


async def sync_item_dates_from_linked_calendars(
    db: Database,
    item_id: str,
) -> None:
    """Write denormalized expiry cache from active linked ``kind=expires`` milestones."""
    clean_id = (item_id or "").strip()
    if not clean_id:
        return
    existing = await db.fetch_one("SELECT id FROM items WHERE id = ?", (clean_id,))
    if existing is None:
        return

    expiry_rows = await _active_linked_expiry_rows(db, clean_id)
    expires_at = _primary_expiry_day(expiry_rows)
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

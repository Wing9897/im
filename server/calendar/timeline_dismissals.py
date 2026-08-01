"""Timeline soft-dismiss markers (analysis / user / RRULE occurrence ids)."""

from __future__ import annotations

from typing import Any, Iterable, Literal, Mapping

from server.db.database import Database
from server.util import utc_now_iso

DismissSource = Literal["analysis", "user", "recurring"]
ALLOWED_SOURCES = frozenset({"analysis", "user", "recurring"})

# Compact calendar-query / agent item ``source`` → ``timeline_dismissals.source``.
CALENDAR_ITEM_DISMISS_SOURCE: dict[str, DismissSource] = {
    "analysis": "analysis",
    "user": "user",
    "recurring": "recurring",
}


class TimelineDismissalValidationError(ValueError):
    """Invalid dismiss source or event id."""


def active_timeline_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop soft-dismissed rows (agent / A2A list paths; UI can still restore)."""
    return [item for item in items if not item.get("dismissed")]


def _require_source(source: str) -> DismissSource:
    value = (source or "").strip()
    if value not in ALLOWED_SOURCES:
        raise TimelineDismissalValidationError("source must be 'analysis', 'user', or 'recurring'")
    return value  # type: ignore[return-value]


def _require_event_id(event_id: str) -> str:
    cleaned = (event_id or "").strip()
    if not cleaned:
        raise TimelineDismissalValidationError("eventId is required")
    return cleaned


def serialize_dismissal(row: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "source": str(row["source"]),
        "eventId": str(row["event_id"]),
        "dismissedAt": row.get("dismissed_at"),
    }


async def dismiss_timeline_event(
    db: Database,
    *,
    source: str,
    event_id: str,
) -> dict[str, Any]:
    """Upsert a soft-dismiss marker. Idempotent."""
    clean_source = _require_source(source)
    clean_id = _require_event_id(event_id)
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO timeline_dismissals (source, event_id, dismissed_at) "
        "VALUES (?, ?, ?) "
        "ON CONFLICT(source, event_id) DO UPDATE SET dismissed_at = excluded.dismissed_at",
        (clean_source, clean_id, now),
    )
    row = await db.fetch_one(
        "SELECT source, event_id, dismissed_at FROM timeline_dismissals WHERE source = ? AND event_id = ?",
        (clean_source, clean_id),
    )
    assert row is not None
    return serialize_dismissal(row)


async def restore_timeline_event(
    db: Database,
    *,
    source: str,
    event_id: str,
) -> bool:
    """Remove a soft-dismiss marker. Returns False when nothing was restored."""
    clean_source = _require_source(source)
    clean_id = _require_event_id(event_id)
    existing = await db.fetch_one(
        "SELECT 1 FROM timeline_dismissals WHERE source = ? AND event_id = ?",
        (clean_source, clean_id),
    )
    if existing is None:
        return False
    await db.execute(
        "DELETE FROM timeline_dismissals WHERE source = ? AND event_id = ?",
        (clean_source, clean_id),
    )
    return True


async def is_timeline_event_dismissed(
    db: Database,
    *,
    source: str,
    event_id: str,
) -> bool:
    clean_source = _require_source(source)
    clean_id = _require_event_id(event_id)
    row = await db.fetch_one(
        "SELECT 1 FROM timeline_dismissals WHERE source = ? AND event_id = ?",
        (clean_source, clean_id),
    )
    return row is not None


async def dismissed_event_ids(
    db: Database,
    *,
    source: str,
    event_ids: Iterable[str],
) -> set[str]:
    """Return the subset of ``event_ids`` that are dismissed for ``source``."""
    clean_source = _require_source(source)
    ids = [str(eid).strip() for eid in event_ids if str(eid).strip()]
    if not ids:
        return set()
    placeholders = ",".join("?" for _ in ids)
    rows = await db.fetch_all(
        f"SELECT event_id FROM timeline_dismissals WHERE source = ? AND event_id IN ({placeholders})",
        (clean_source, *ids),
    )
    return {str(row["event_id"]) for row in rows}


async def list_timeline_dismissals(
    db: Database,
    *,
    source: str | None = None,
) -> list[dict[str, Any]]:
    if source is None or not str(source).strip():
        rows = await db.fetch_all(
            "SELECT source, event_id, dismissed_at FROM timeline_dismissals "
            "ORDER BY dismissed_at DESC, source ASC, event_id ASC"
        )
    else:
        clean_source = _require_source(source)
        rows = await db.fetch_all(
            "SELECT source, event_id, dismissed_at FROM timeline_dismissals "
            "WHERE source = ? ORDER BY dismissed_at DESC, event_id ASC",
            (clean_source,),
        )
    return [serialize_dismissal(row) for row in rows]


async def attach_dismissed_flag(
    db: Database,
    *,
    source: str,
    items: list[dict[str, Any]],
    id_key: str = "id",
) -> list[dict[str, Any]]:
    """Mutate/return items with ``dismissed: bool`` for the given source."""
    if not items:
        return items
    dismissed = await dismissed_event_ids(
        db,
        source=source,
        event_ids=(str(item.get(id_key) or "") for item in items),
    )
    for item in items:
        item["dismissed"] = str(item.get(id_key) or "") in dismissed
    return items

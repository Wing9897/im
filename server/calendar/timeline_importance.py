"""Timeline 「重要事件」 markers (analysis / user / RRULE / item occurrence ids)."""

from __future__ import annotations

from typing import Any, Iterable, Mapping

from server.db.database import Database
from server.domain.timeline_sources import (
    ALLOWED_TIMELINE_SOURCES,
    TIMELINE_SOURCE_ERROR,
    TimelineSource,
)
from server.util import utc_now_iso

ImportanceSource = TimelineSource
ALLOWED_SOURCES = ALLOWED_TIMELINE_SOURCES

# Compact calendar-query / agent item ``source`` → ``timeline_importance.source``.
CALENDAR_ITEM_IMPORTANCE_SOURCE: dict[str, ImportanceSource] = {
    "analysis": "analysis",
    "user": "user",
    "recurring": "recurring",
    "item_remind": "item_remind",
}

#: Display glyph for important markers (UI + agent copy).
IMPORTANT_EMOJI = "❗"


class TimelineImportanceValidationError(ValueError):
    """Invalid importance source or event id."""


def _require_source(source: str) -> ImportanceSource:
    value = (source or "").strip()
    if value not in ALLOWED_SOURCES:
        raise TimelineImportanceValidationError(TIMELINE_SOURCE_ERROR)
    return value  # type: ignore[return-value]


def _require_event_id(event_id: str) -> str:
    cleaned = (event_id or "").strip()
    if not cleaned:
        raise TimelineImportanceValidationError("eventId is required")
    return cleaned


def serialize_importance(row: Mapping[str, Any]) -> dict[str, Any]:
    return {
        "source": str(row["source"]),
        "eventId": str(row["event_id"]),
        "markedAt": row.get("marked_at"),
    }


async def mark_timeline_important(
    db: Database,
    *,
    source: str,
    event_id: str,
) -> dict[str, Any]:
    """Upsert an importance marker. Idempotent."""
    clean_source = _require_source(source)
    clean_id = _require_event_id(event_id)
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO timeline_importance (source, event_id, marked_at) "
        "VALUES (?, ?, ?) "
        "ON CONFLICT(source, event_id) DO UPDATE SET marked_at = excluded.marked_at",
        (clean_source, clean_id, now),
    )
    row = await db.fetch_one(
        "SELECT source, event_id, marked_at FROM timeline_importance WHERE source = ? AND event_id = ?",
        (clean_source, clean_id),
    )
    assert row is not None
    return serialize_importance(row)


async def unmark_timeline_important(
    db: Database,
    *,
    source: str,
    event_id: str,
) -> bool:
    """Remove an importance marker. Returns False when nothing was cleared."""
    clean_source = _require_source(source)
    clean_id = _require_event_id(event_id)
    existing = await db.fetch_one(
        "SELECT 1 FROM timeline_importance WHERE source = ? AND event_id = ?",
        (clean_source, clean_id),
    )
    if existing is None:
        return False
    await db.execute(
        "DELETE FROM timeline_importance WHERE source = ? AND event_id = ?",
        (clean_source, clean_id),
    )
    return True


async def is_timeline_event_important(
    db: Database,
    *,
    source: str,
    event_id: str,
) -> bool:
    clean_source = _require_source(source)
    clean_id = _require_event_id(event_id)
    row = await db.fetch_one(
        "SELECT 1 FROM timeline_importance WHERE source = ? AND event_id = ?",
        (clean_source, clean_id),
    )
    return row is not None


async def important_event_ids(
    db: Database,
    *,
    source: str,
    event_ids: Iterable[str],
) -> set[str]:
    """Return the subset of ``event_ids`` marked important for ``source``."""
    clean_source = _require_source(source)
    ids = [str(eid).strip() for eid in event_ids if str(eid).strip()]
    if not ids:
        return set()
    placeholders = ",".join("?" for _ in ids)
    rows = await db.fetch_all(
        f"SELECT event_id FROM timeline_importance WHERE source = ? AND event_id IN ({placeholders})",
        (clean_source, *ids),
    )
    return {str(row["event_id"]) for row in rows}


async def list_timeline_importance(
    db: Database,
    *,
    source: str | None = None,
) -> list[dict[str, Any]]:
    if source is None or not str(source).strip():
        rows = await db.fetch_all(
            "SELECT source, event_id, marked_at FROM timeline_importance "
            "ORDER BY marked_at DESC, source ASC, event_id ASC"
        )
    else:
        clean_source = _require_source(source)
        rows = await db.fetch_all(
            "SELECT source, event_id, marked_at FROM timeline_importance "
            "WHERE source = ? ORDER BY marked_at DESC, event_id ASC",
            (clean_source,),
        )
    return [serialize_importance(row) for row in rows]


async def attach_important_flag(
    db: Database,
    *,
    source: str,
    items: list[dict[str, Any]],
    id_key: str = "id",
) -> list[dict[str, Any]]:
    """Mutate/return items with ``important: bool`` for the given source."""
    if not items:
        return items
    marked = await important_event_ids(
        db,
        source=source,
        event_ids=(str(item.get(id_key) or "") for item in items),
    )
    for item in items:
        item["important"] = str(item.get(id_key) or "") in marked
    return items

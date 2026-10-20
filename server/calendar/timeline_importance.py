"""Timeline 「重要事件」 markers (analysis / user / RRULE / item occurrence ids).

Importance writes do not mark published worksets dirty.
"""

from __future__ import annotations

from typing import Any

from server.calendar.timeline_markers import TimelineMarkers
from server.db.database import Database
from server.domain.timeline_sources import ALLOWED_TIMELINE_SOURCES, TimelineSource
from server.wire.serializers import serialize_importance

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


_IMPORTANCE = TimelineMarkers(
    table="timeline_importance",
    timestamp_column="marked_at",
    serializer=serialize_importance,
    validation_error=TimelineImportanceValidationError,
    flag_key="important",
)


async def mark_timeline_important(
    db: Database,
    *,
    source: str,
    event_id: str,
) -> dict[str, Any]:
    """Upsert an importance marker. Idempotent."""
    return await _IMPORTANCE.upsert(db, source=source, event_id=event_id)


async def unmark_timeline_important(
    db: Database,
    *,
    source: str,
    event_id: str,
) -> bool:
    """Remove an importance marker. Returns False when nothing was cleared."""
    return await _IMPORTANCE.clear(db, source=source, event_id=event_id)


async def is_timeline_event_important(
    db: Database,
    *,
    source: str,
    event_id: str,
) -> bool:
    return await _IMPORTANCE.contains(db, source=source, event_id=event_id)


async def list_timeline_importance(
    db: Database,
    *,
    source: str | None = None,
) -> list[dict[str, Any]]:
    return await _IMPORTANCE.list_rows(db, source=source)


async def attach_important_flag(
    db: Database,
    *,
    source: str,
    items: list[dict[str, Any]],
    id_key: str = "id",
) -> list[dict[str, Any]]:
    """Mutate/return items with ``important: bool`` for the given source."""
    return await _IMPORTANCE.attach(db, source=source, items=items, id_key=id_key)

"""Timeline soft-dismiss markers (analysis / user / RRULE occurrence ids)."""

from __future__ import annotations

from typing import Any

from server.calendar.timeline_markers import TimelineMarkers
from server.db.database import Database
from server.domain.timeline_sources import ALLOWED_TIMELINE_SOURCES, TimelineSource
from server.wire.serializer_domains.calendar import serialize_dismissal

DismissSource = TimelineSource
ALLOWED_SOURCES = ALLOWED_TIMELINE_SOURCES

# Compact calendar-query / agent item ``source`` → ``timeline_dismissals.source``.
CALENDAR_ITEM_DISMISS_SOURCE: dict[str, DismissSource] = {
    "analysis": "analysis",
    "user": "user",
    "recurring": "recurring",
    "item_remind": "item_remind",
}


class TimelineDismissalValidationError(ValueError):
    """Invalid dismiss source or event id."""


async def _mark_published_dirty(db: Database, source: str, event_id: str) -> None:
    from server.calendar_share.dirty import mark_published_workset_dirty, workset_ids_for_timeline_event

    await mark_published_workset_dirty(db, *await workset_ids_for_timeline_event(db, source=source, event_id=event_id))


_DISMISSALS = TimelineMarkers(
    table="timeline_dismissals",
    timestamp_column="dismissed_at",
    serializer=serialize_dismissal,
    validation_error=TimelineDismissalValidationError,
    flag_key="dismissed",
    after_write=_mark_published_dirty,
)


def active_timeline_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Drop soft-dismissed rows (agent / A2A list paths; UI can still restore)."""
    return [item for item in items if not item.get("dismissed")]


async def dismiss_timeline_event(
    db: Database,
    *,
    source: str,
    event_id: str,
) -> dict[str, Any]:
    """Upsert a soft-dismiss marker. Idempotent."""
    return await _DISMISSALS.upsert(db, source=source, event_id=event_id)


async def restore_timeline_event(
    db: Database,
    *,
    source: str,
    event_id: str,
) -> bool:
    """Remove a soft-dismiss marker. Returns False when nothing was restored."""
    return await _DISMISSALS.clear(db, source=source, event_id=event_id)


async def is_timeline_event_dismissed(
    db: Database,
    *,
    source: str,
    event_id: str,
) -> bool:
    return await _DISMISSALS.contains(db, source=source, event_id=event_id)


async def list_timeline_dismissals(
    db: Database,
    *,
    source: str | None = None,
) -> list[dict[str, Any]]:
    return await _DISMISSALS.list_rows(db, source=source)


async def attach_dismissed_flag(
    db: Database,
    *,
    source: str,
    items: list[dict[str, Any]],
    id_key: str = "id",
) -> list[dict[str, Any]]:
    """Mutate/return items with ``dismissed: bool`` for the given source."""
    return await _DISMISSALS.attach(db, source=source, items=items, id_key=id_key)

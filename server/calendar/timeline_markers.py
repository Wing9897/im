"""Shared soft-marker table for timeline dismissals and importance.

``after_write`` runs only when a caller opts in. Dismiss / restore mark
published worksets dirty. Importance does not.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable, Iterable, Mapping
from typing import Any

from server.db.database import Database
from server.domain.timeline_sources import (
    ALLOWED_TIMELINE_SOURCES,
    TIMELINE_SOURCE_ERROR,
    TimelineSource,
)
from server.util import utc_now_iso

_ALLOWED_TABLES = frozenset({"timeline_dismissals", "timeline_importance"})
_ALLOWED_TIMESTAMP_COLUMNS = frozenset({"dismissed_at", "marked_at"})

Serializer = Callable[[Mapping[str, Any]], dict[str, Any]]
AfterWrite = Callable[[Database, str, str], Awaitable[None]]


class TimelineMarkers:
    """One marker table keyed by ``(source, event_id)``."""

    def __init__(
        self,
        *,
        table: str,
        timestamp_column: str,
        serializer: Serializer,
        validation_error: type[ValueError],
        flag_key: str,
        after_write: AfterWrite | None = None,
    ) -> None:
        if table not in _ALLOWED_TABLES:
            raise ValueError(f"unsupported timeline marker table: {table}")
        if timestamp_column not in _ALLOWED_TIMESTAMP_COLUMNS:
            raise ValueError(f"unsupported timeline marker timestamp: {timestamp_column}")
        self.table = table
        self.timestamp_column = timestamp_column
        self.serializer = serializer
        self.validation_error = validation_error
        self.flag_key = flag_key
        self.after_write = after_write

    def require_source(self, source: str) -> TimelineSource:
        value = (source or "").strip()
        if value not in ALLOWED_TIMELINE_SOURCES:
            raise self.validation_error(TIMELINE_SOURCE_ERROR)
        return value  # type: ignore[return-value]

    def require_event_id(self, event_id: str) -> str:
        cleaned = (event_id or "").strip()
        if not cleaned:
            raise self.validation_error("eventId is required")
        return cleaned

    async def _notify(self, db: Database, source: str, event_id: str) -> None:
        if self.after_write is None:
            return
        await self.after_write(db, source, event_id)

    async def upsert(self, db: Database, *, source: str, event_id: str) -> dict[str, Any]:
        """Insert or refresh the marker. Idempotent."""
        clean_source = self.require_source(source)
        clean_id = self.require_event_id(event_id)
        now = utc_now_iso()
        column = self.timestamp_column
        await db.execute(
            f"INSERT INTO {self.table} (source, event_id, {column}) "
            "VALUES (?, ?, ?) "
            f"ON CONFLICT(source, event_id) DO UPDATE SET {column} = excluded.{column}",
            (clean_source, clean_id, now),
        )
        row = await db.fetch_one(
            f"SELECT source, event_id, {column} FROM {self.table} WHERE source = ? AND event_id = ?",
            (clean_source, clean_id),
        )
        assert row is not None
        await self._notify(db, clean_source, clean_id)
        return self.serializer(row)

    async def clear(self, db: Database, *, source: str, event_id: str) -> bool:
        """Delete a marker. Returns False when nothing was removed."""
        clean_source = self.require_source(source)
        clean_id = self.require_event_id(event_id)
        existing = await db.fetch_one(
            f"SELECT 1 FROM {self.table} WHERE source = ? AND event_id = ?",
            (clean_source, clean_id),
        )
        if existing is None:
            return False
        await db.execute(
            f"DELETE FROM {self.table} WHERE source = ? AND event_id = ?",
            (clean_source, clean_id),
        )
        await self._notify(db, clean_source, clean_id)
        return True

    async def contains(self, db: Database, *, source: str, event_id: str) -> bool:
        clean_source = self.require_source(source)
        clean_id = self.require_event_id(event_id)
        row = await db.fetch_one(
            f"SELECT 1 FROM {self.table} WHERE source = ? AND event_id = ?",
            (clean_source, clean_id),
        )
        return row is not None

    async def ids_among(self, db: Database, *, source: str, event_ids: Iterable[str]) -> set[str]:
        clean_source = self.require_source(source)
        ids = [str(eid).strip() for eid in event_ids if str(eid).strip()]
        if not ids:
            return set()
        placeholders = ",".join("?" for _ in ids)
        rows = await db.fetch_all(
            f"SELECT event_id FROM {self.table} WHERE source = ? AND event_id IN ({placeholders})",
            (clean_source, *ids),
        )
        return {str(row["event_id"]) for row in rows}

    async def list_rows(self, db: Database, *, source: str | None = None) -> list[dict[str, Any]]:
        column = self.timestamp_column
        if source is None or not str(source).strip():
            rows = await db.fetch_all(
                f"SELECT source, event_id, {column} FROM {self.table} ORDER BY {column} DESC, source ASC, event_id ASC"
            )
        else:
            clean_source = self.require_source(source)
            rows = await db.fetch_all(
                f"SELECT source, event_id, {column} FROM {self.table} "
                f"WHERE source = ? ORDER BY {column} DESC, event_id ASC",
                (clean_source,),
            )
        return [self.serializer(row) for row in rows]

    async def attach(
        self,
        db: Database,
        *,
        source: str,
        items: list[dict[str, Any]],
        id_key: str = "id",
    ) -> list[dict[str, Any]]:
        if not items:
            return items
        marked = await self.ids_among(
            db,
            source=source,
            event_ids=(str(item.get(id_key) or "") for item in items),
        )
        for item in items:
            item[self.flag_key] = str(item.get(id_key) or "") in marked
        return items


_MARKER_ID_CHUNK_SIZE = 400


async def attach_timeline_flags(
    db: Database,
    *,
    source: str,
    items: list[dict[str, Any]],
    id_key: str = "id",
    include_important: bool = True,
) -> list[dict[str, Any]]:
    """Attach ``dismissed`` (and ``important`` when ``include_important=True``) in one query."""
    clean_source = (source or "").strip()
    if clean_source not in ALLOWED_TIMELINE_SOURCES:
        raise ValueError(TIMELINE_SOURCE_ERROR)
    if not items:
        return items
    ids = list(
        dict.fromkeys(
            str(item.get(id_key) or "").strip()
            for item in items
            if str(item.get(id_key) or "").strip()
        )
    )
    dismissed_ids: set[str] = set()
    important_ids: set[str] = set()
    if ids:
        for start in range(0, len(ids), _MARKER_ID_CHUNK_SIZE):
            chunk = ids[start : start + _MARKER_ID_CHUNK_SIZE]
            placeholders = ",".join("?" for _ in chunk)
            if include_important:
                rows = await db.fetch_all(
                    f"SELECT event_id, 1 AS is_dismissed, 0 AS is_important "
                    f"FROM timeline_dismissals WHERE source = ? AND event_id IN ({placeholders}) "
                    f"UNION ALL "
                    f"SELECT event_id, 0 AS is_dismissed, 1 AS is_important "
                    f"FROM timeline_importance WHERE source = ? AND event_id IN ({placeholders})",
                    (clean_source, *chunk, clean_source, *chunk),
                )
                for row in rows:
                    eid = str(row["event_id"])
                    if row.get("is_dismissed"):
                        dismissed_ids.add(eid)
                    if row.get("is_important"):
                        important_ids.add(eid)
            else:
                rows = await db.fetch_all(
                    f"SELECT event_id FROM timeline_dismissals "
                    f"WHERE source = ? AND event_id IN ({placeholders})",
                    (clean_source, *chunk),
                )
                dismissed_ids.update(str(row["event_id"]) for row in rows)
    for item in items:
        eid = str(item.get(id_key) or "").strip()
        item["dismissed"] = eid in dismissed_ids
        if include_important:
            item["important"] = eid in important_ids
    return items

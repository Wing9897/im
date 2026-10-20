"""Atomic UID upsert helpers for ICS calendar import commit."""

from __future__ import annotations

import json
from typing import Any

from server.calendar.ics import ParsedIcsEvent
from server.queries.calendar_import_queries import (
    insert_imported_recurring_series,
    insert_imported_user_event,
    update_imported_recurring_series,
    update_imported_user_event,
)
from server.worksets_const import SYSTEM_WORKSET_ID


async def _upsert_user_event(
    conn: Any,
    *,
    event: ParsedIcsEvent,
    source: str,
    existing_id: str | None,
    now: str,
) -> tuple[str, str]:
    # Lazy facade lookup so tests can monkeypatch ``server.calendar.imports.new_id``.
    from server.calendar import imports as imports_mod

    if existing_id is None:
        event_id = imports_mod.new_id()
        await insert_imported_user_event(
            conn,
            event_id=event_id,
            title=event.title,
            description=event.description,
            start_time=event.start_time,
            end_time=event.end_time,
            location=event.location,
            is_all_day=event.is_all_day,
            timezone_id=event.timezone_id,
            uid=event.uid,
            source=source,
            fingerprint=event.fingerprint,
            workset_id=SYSTEM_WORKSET_ID,
            now=now,
        )
        return event_id, "created"
    await update_imported_user_event(
        conn,
        event_id=existing_id,
        title=event.title,
        description=event.description,
        start_time=event.start_time,
        end_time=event.end_time,
        location=event.location,
        is_all_day=event.is_all_day,
        timezone_id=event.timezone_id,
        fingerprint=event.fingerprint,
        now=now,
    )
    return existing_id, "updated"


async def _upsert_recurring_task(
    conn: Any,
    *,
    event: ParsedIcsEvent,
    source: str,
    existing_id: str | None,
    now: str,
) -> tuple[str, str]:
    """Upsert a standalone recurring series (wire targetType ``recurring``)."""
    from server.calendar import imports as imports_mod

    assert event.rrule is not None
    exdates_json = json.dumps(event.exdates, ensure_ascii=False, separators=(",", ":"))
    rdates_json = json.dumps(event.rdates, ensure_ascii=False, separators=(",", ":"))
    if existing_id is None:
        series_id = imports_mod.new_id()
        await insert_imported_recurring_series(
            conn,
            series_id=series_id,
            title=event.title,
            workset_id=SYSTEM_WORKSET_ID,
            rrule=event.rrule,
            dtstart=event.start_local or event.start_time,
            dtend=event.end_local or event.end_time,
            is_all_day=event.is_all_day,
            location=event.location or None,
            description=event.description or None,
            timezone_id=event.timezone_id,
            timezone_ical=event.timezone_ical,
            exdates_json=exdates_json,
            rdates_json=rdates_json,
            uid=event.uid,
            source=source,
            fingerprint=event.fingerprint,
            now=now,
        )
        return series_id, "created"
    await update_imported_recurring_series(
        conn,
        series_id=existing_id,
        title=event.title,
        rrule=event.rrule,
        dtstart=event.start_local or event.start_time,
        dtend=event.end_local or event.end_time,
        is_all_day=event.is_all_day,
        location=event.location or None,
        description=event.description or None,
        timezone_id=event.timezone_id,
        timezone_ical=event.timezone_ical,
        exdates_json=exdates_json,
        rdates_json=rdates_json,
        fingerprint=event.fingerprint,
        now=now,
    )
    return existing_id, "updated"

"""Calendar tool handlers — write path (events / recurring / importance)."""

from __future__ import annotations

from typing import Any

from server.agent.tool_args import arg
from server.calendar.query import get_event
from server.calendar.timeline_dismissals import (
    CALENDAR_ITEM_DISMISS_SOURCE,
    dismiss_timeline_event,
)
from server.calendar.timeline_importance import (
    CALENDAR_ITEM_IMPORTANCE_SOURCE,
    IMPORTANT_EMOJI,
    mark_timeline_important,
    unmark_timeline_important,
)
from server.calendar.user_events_normalize import UserEventValidationError
from server.calendar.user_events_write import (
    create_user_event,
    update_user_event,
)
from server.calendar.write_input import RecurringSeriesWriteInput, UserEventWriteInput
from server.db.database import Database
from server.services.recurring_series_create import create_recurring_series
from server.services.recurring_series_patch import (
    hard_delete_recurring_series,
    patch_recurring_series,
)
from server.services.task_writes import TaskWriteError
from server.wire.serializer_domains.recurring import serialize_recurring_series


async def _tool_create_event(db: Database, args: dict[str, Any]) -> dict[str, Any]:
    payload = UserEventWriteInput.from_tool_args(args, action="create")
    if not payload.title or not payload.startTime:
        return {"error": "title and startTime are required"}
    try:
        # Kind stays normal: expires / purchase_effective are Items UI only.
        item = await create_user_event(db, **payload.service_kwargs())
    except UserEventValidationError as exc:
        return {"error": str(exc)}
    return {"item": item}


async def _tool_create_recurring_series(db: Database, args: dict[str, Any]) -> dict[str, Any]:
    """Create a standalone recurring calendar series."""
    payload = RecurringSeriesWriteInput.from_tool_args(args, action="create")
    try:
        row = await create_recurring_series(db, **payload.service_kwargs())
    except TaskWriteError as exc:
        return {"error": str(exc)}
    return {"series": serialize_recurring_series(row)}


async def _tool_update_recurring_series(db: Database, args: dict[str, Any]) -> dict[str, Any]:
    """Patch an existing recurring series. Id is the series id."""
    payload = RecurringSeriesWriteInput.from_tool_args(args, action="update")
    if not payload.has_updates():
        return {"error": "at least one field to update is required"}

    try:
        updated = await patch_recurring_series(db, **payload.service_kwargs())
    except TaskWriteError as exc:
        return {"error": str(exc)}
    return {"series": serialize_recurring_series(updated)}


async def _tool_delete_recurring_series(db: Database, args: dict[str, Any]) -> dict[str, Any]:
    """Hard-delete a recurring series (same as Schedule UI / REST DELETE)."""
    series_id = arg(args, "id", "seriesId", "series_id")
    require_parent = args.get("_require_parent_task_id")
    try:
        deleted = await hard_delete_recurring_series(
            db,
            series_id=str(series_id or ""),
            require_parent_task_id=str(require_parent) if require_parent else None,
        )
    except TaskWriteError as exc:
        return {"error": str(exc), "deleted": False}
    sid = str(deleted["id"])
    return {
        "deleted": True,
        "id": sid,
        "seriesId": sid,
        "series": serialize_recurring_series(deleted),
    }


async def _tool_update_event(db: Database, args: dict[str, Any]) -> dict[str, Any]:
    event_id = arg(args, "id", "eventId", "event_id")
    if not event_id:
        return {"error": "id is required"}
    payload = UserEventWriteInput.from_tool_args(args, action="update")
    if not payload.fields_set:
        return {"error": "at least one field to update is required"}
    try:
        item = await update_user_event(db, str(event_id), **payload.service_kwargs())
    except UserEventValidationError as exc:
        return {"error": str(exc)}
    if item is None:
        return {"error": f"event not found: {event_id}", "item": None}
    return {"item": item}


async def _tool_delete_event(db: Database, args: dict[str, Any]) -> dict[str, Any]:
    event_id = arg(args, "id", "eventId", "event_id")
    if not event_id:
        return {"error": "id is required"}
    eid = str(event_id)
    item = await get_event(db, event_id=eid)
    if item is None:
        return {"error": f"event not found: {event_id}", "deleted": False}
    if item.get("dismissed"):
        return {"deleted": True, "dismissed": True, "id": eid}
    raw_source = str(item.get("source") or "")
    dismiss_source = CALENDAR_ITEM_DISMISS_SOURCE.get(raw_source)
    if dismiss_source is None:
        return {"error": f"unsupported event source for dismiss: {raw_source}", "deleted": False}
    await dismiss_timeline_event(db, source=dismiss_source, event_id=eid)
    return {"deleted": True, "dismissed": True, "id": eid, "source": dismiss_source}


async def _tool_mark_important(db: Database, args: dict[str, Any]) -> dict[str, Any]:
    event_id = arg(args, "id", "eventId", "event_id")
    if not event_id:
        return {"error": "id is required"}
    eid = str(event_id)
    item = await get_event(db, event_id=eid)
    if item is None:
        return {"error": f"event not found: {event_id}", "important": False}
    raw_source = str(item.get("source") or "")
    importance_source = CALENDAR_ITEM_IMPORTANCE_SOURCE.get(raw_source)
    if importance_source is None:
        return {"error": f"unsupported event source for importance: {raw_source}", "important": False}
    marker = await mark_timeline_important(db, source=importance_source, event_id=eid)
    return {
        "important": True,
        "emoji": IMPORTANT_EMOJI,
        "id": eid,
        "source": importance_source,
        "markedAt": marker.get("markedAt"),
    }


async def _tool_unmark_important(db: Database, args: dict[str, Any]) -> dict[str, Any]:
    event_id = arg(args, "id", "eventId", "event_id")
    if not event_id:
        return {"error": "id is required"}
    eid = str(event_id)
    item = await get_event(db, event_id=eid)
    if item is None:
        return {"error": f"event not found: {event_id}", "important": False}
    raw_source = str(item.get("source") or "")
    importance_source = CALENDAR_ITEM_IMPORTANCE_SOURCE.get(raw_source)
    if importance_source is None:
        return {"error": f"unsupported event source for importance: {raw_source}", "important": False}
    cleared = await unmark_timeline_important(db, source=importance_source, event_id=eid)
    return {
        "important": False,
        "cleared": cleared,
        "id": eid,
        "source": importance_source,
    }


__all__ = [
    "_tool_create_event",
    "_tool_create_recurring_series",
    "_tool_delete_event",
    "_tool_delete_recurring_series",
    "_tool_mark_important",
    "_tool_unmark_important",
    "_tool_update_event",
    "_tool_update_recurring_series",
]

"""Calendar tool handlers — write path (events / recurring / importance)."""

from __future__ import annotations

from typing import Any

from server.agent.tool_args import arg, as_bool
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
from server.calendar.user_events import (
    create_user_event,
    update_user_event,
)
from server.calendar.user_events_normalize import UserEventValidationError
from server.db.database import Database
from server.domain.user_event_origins import (
    ORIGIN_ASSISTANT,
    TOOL_WRITE_USER_EVENT_ORIGINS,
)
from server.services.recurring_series_writes import (
    create_recurring_series,
    hard_delete_recurring_series,
    patch_recurring_series,
)
from server.services.task_writes import TaskWriteError
from server.wire.serializer_domains.recurring import serialize_recurring_series


def _tool_task_id(args: dict[str, Any]) -> Any:
    if "taskId" in args or "task_id" in args:
        return arg(args, "taskId", "task_id")
    return args.get("_default_task_id")


def _tool_workset_id(args: dict[str, Any]) -> Any:
    if "worksetId" in args or "workset_id" in args:
        return arg(args, "worksetId", "workset_id")
    if "_default_workset_id" in args:
        return args.get("_default_workset_id")
    return None


async def _tool_create_event(db: Database, args: dict[str, Any]) -> dict[str, Any]:
    title = args.get("title")
    start = arg(args, "startTime", "start", "start_time")
    if not title or not start:
        return {"error": "title and startTime are required"}
    end = arg(args, "endTime", "end", "end_time")
    try:
        origin = str(args.get("_origin") or ORIGIN_ASSISTANT).strip() or ORIGIN_ASSISTANT
        # Tool writes use an explicit allow-subset (excludes ``ics`` imports).
        if origin not in TOOL_WRITE_USER_EVENT_ORIGINS:
            origin = ORIGIN_ASSISTANT
        workset_id = _tool_workset_id(args)
        create_kwargs: dict[str, Any] = {
            "title": str(title),
            "start_time": str(start),
            "end_time": str(end) if end else None,
            "body": str(arg(args, "body", "description") or ""),
            "location": str(args.get("location") or ""),
            "origin": origin,
            "task_id": _tool_task_id(args),
            # Special linked-calendar kinds (expires / purchase_effective) + amount
            # are Items UI only — agent always creates generic timeline events.
            "kind": "normal",
        }
        if workset_id is not None:
            create_kwargs["workset_id"] = workset_id
        item = await create_user_event(db, **create_kwargs)
    except UserEventValidationError as exc:
        return {"error": str(exc)}
    return {"item": item}


async def _tool_create_recurring_series(db: Database, args: dict[str, Any]) -> dict[str, Any]:
    """Create a standalone recurring calendar series."""
    name = arg(args, "name", "title")
    parent_raw = args.get("_parent_task_id")
    parent_task_id = str(parent_raw).strip() if parent_raw not in (None, "") else None
    try:
        row = await create_recurring_series(
            db,
            name=str(name or ""),
            rrule=str(arg(args, "rrule", "RRule") or ""),
            event_start_time=arg(args, "eventStartTime", "startTime", "start"),
            event_end_time=arg(args, "eventEndTime", "endTime", "end"),
            event_is_all_day=as_bool(arg(args, "eventIsAllDay", "isAllDay"), False),
            event_location=arg(args, "eventLocation", "location"),
            event_description=arg(args, "eventDescription", "body", "description"),
            parent_task_id=parent_task_id,
        )
    except TaskWriteError as exc:
        return {"error": str(exc)}
    return {"series": serialize_recurring_series(row)}


async def _tool_update_recurring_series(db: Database, args: dict[str, Any]) -> dict[str, Any]:
    """Patch an existing recurring series. Id is the series id."""
    series_id = arg(args, "id", "seriesId", "series_id")
    require_parent = args.get("_require_parent_task_id")

    kwargs: dict[str, Any] = {
        "series_id": str(series_id or ""),
        "require_parent_task_id": str(require_parent) if require_parent else None,
    }
    if "name" in args or "title" in args:
        kwargs["name"] = arg(args, "name", "title")
    if "rrule" in args or "RRule" in args:
        kwargs["rrule"] = arg(args, "rrule", "RRule")
    if "eventIsAllDay" in args or "isAllDay" in args:
        kwargs["event_is_all_day"] = as_bool(arg(args, "eventIsAllDay", "isAllDay"), False)
    if "eventStartTime" in args or "startTime" in args or "start" in args:
        kwargs["event_start_time"] = arg(args, "eventStartTime", "startTime", "start")
    if "eventEndTime" in args or "endTime" in args or "end" in args:
        kwargs["event_end_time"] = arg(args, "eventEndTime", "endTime", "end")
    if "eventLocation" in args or "location" in args:
        kwargs["event_location"] = arg(args, "eventLocation", "location")
    if "eventDescription" in args or "body" in args or "description" in args:
        kwargs["event_description"] = arg(args, "eventDescription", "body", "description")
    if "isActive" in args or "is_active" in args:
        kwargs["is_active"] = as_bool(arg(args, "isActive", "is_active"), True)

    patch_keys = {
        "name",
        "rrule",
        "event_is_all_day",
        "event_start_time",
        "event_end_time",
        "event_location",
        "event_description",
        "is_active",
    }
    if not any(key in kwargs for key in patch_keys):
        return {"error": "at least one field to update is required"}

    try:
        updated = await patch_recurring_series(db, **kwargs)
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
    kwargs: dict[str, Any] = {}
    if "title" in args and args["title"] is not None:
        kwargs["title"] = str(args["title"])
    if "startTime" in args or "start" in args or "start_time" in args:
        kwargs["start_time"] = str(arg(args, "startTime", "start", "start_time"))
    if "endTime" in args or "end" in args or "end_time" in args:
        end_val = arg(args, "endTime", "end", "end_time")
        kwargs["end_time"] = None if end_val in (None, "") else str(end_val)
    if "body" in args or "description" in args:
        kwargs["body"] = str(arg(args, "body", "description") or "")
    if "location" in args:
        kwargs["location"] = str(args.get("location") or "")
    if "taskId" in args or "task_id" in args:
        kwargs["task_id"] = arg(args, "taskId", "task_id")
    if "worksetId" in args or "workset_id" in args:
        kwargs["workset_id"] = arg(args, "worksetId", "workset_id")
    if not kwargs:
        return {"error": "at least one field to update is required"}
    try:
        item = await update_user_event(db, str(event_id), **kwargs)
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

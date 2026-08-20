"""Calendar tool handlers — read path (list / query / get)."""

from __future__ import annotations

from typing import Any

from server.agent.tool_args import arg, as_bool, as_optional_int
from server.agent.tool_limits import (
    CALENDAR_DEFAULT_LIST_LIMIT,
    CALENDAR_DEFAULT_WINDOW_LIMIT,
    CALENDAR_RESULT_HARD_CAP,
)
from server.calendar.query import (
    get_event,
    list_calendars,
    query_recent,
    query_upcoming,
    query_window,
)
from server.calendar.query_fetch import calendar_list_item_from_task_row
from server.calendar.timeline_dismissals import active_timeline_items
from server.db.database import Database
from server.queries.calendar_queries import TASK_CALENDAR_NULL_EVENT_COLS


def _filter_task_id(args: dict[str, Any]) -> Any:
    """Analysis-task filter for upcoming/recent/window (not a series id)."""
    return arg(args, "taskId", "task_id")


def _filter_series_id(args: dict[str, Any]) -> Any:
    """Recurring-series filter (series id or parent agent task id for children)."""
    return arg(args, "seriesId", "series_id")


async def _tool_list_calendars(db: Database, args: dict[str, Any]) -> dict[str, Any]:
    scope_task_id = args.get("_agent_scope_task_id") or arg(args, "taskId", "task_id")
    include_inactive = as_bool(arg(args, "includeInactive", "include_inactive"), False)
    items = await list_calendars(db, include_inactive=include_inactive)
    if scope_task_id:
        tid = str(scope_task_id).strip()
        # Agent-scope tick: only this task row + its child recurring series.
        scoped: list[dict[str, Any]] = []
        child_ids = {
            str(r["id"])
            for r in await db.fetch_all(
                "SELECT id FROM recurring_schedules WHERE parent_task_id = ?",
                (tid,),
            )
        }
        for item in items:
            iid = str(item.get("id") or "")
            if iid == tid or iid in child_ids:
                scoped.append(item)
        # Ensure the scoped task itself appears even if list_calendars omitted it.
        if not any(str(i.get("id")) == tid for i in scoped):
            row = await db.fetch_one(
                "SELECT id, name, analysis_mode, is_active, "
                f"{TASK_CALENDAR_NULL_EVENT_COLS} "
                "FROM analysis_tasks WHERE id = ?",
                (tid,),
            )
            if row is not None:
                scoped.insert(0, calendar_list_item_from_task_row(row))
        items = scoped
    return {"calendars": items, "count": len(items)}


async def _tool_upcoming(db: Database, args: dict[str, Any]) -> dict[str, Any]:
    days_raw = args.get("days")
    days = as_optional_int(days_raw, 0) if days_raw not in (None, "") else None
    if days is not None and days < 1:
        days = None
    result = await query_upcoming(
        db,
        limit=as_optional_int(args.get("limit"), CALENDAR_DEFAULT_LIST_LIMIT) or CALENDAR_DEFAULT_LIST_LIMIT,
        days=days,
        search=args.get("search"),
        task_id=_filter_task_id(args),
        series_id=_filter_series_id(args),
        hard_cap=CALENDAR_RESULT_HARD_CAP,
    )
    result["items"] = active_timeline_items(result.get("items") or [])
    return result


async def _tool_recent(db: Database, args: dict[str, Any]) -> dict[str, Any]:
    result = await query_recent(
        db,
        limit=as_optional_int(args.get("limit"), CALENDAR_DEFAULT_LIST_LIMIT) or CALENDAR_DEFAULT_LIST_LIMIT,
        search=args.get("search"),
        task_id=_filter_task_id(args),
        series_id=_filter_series_id(args),
        hard_cap=CALENDAR_RESULT_HARD_CAP,
    )
    result["items"] = active_timeline_items(result.get("items") or [])
    return result


async def _tool_window(db: Database, args: dict[str, Any]) -> dict[str, Any]:
    # Canonical: startTime/endTime (HTTP-aligned). start/end remain accepted aliases.
    start = arg(args, "startTime", "start")
    end = arg(args, "endTime", "end")
    if not start or not end:
        return {"error": "startTime and endTime are required (ISO-8601)"}
    try:
        result = await query_window(
            db,
            start=str(start),
            end=str(end),
            limit=as_optional_int(args.get("limit"), CALENDAR_DEFAULT_WINDOW_LIMIT) or CALENDAR_DEFAULT_WINDOW_LIMIT,
            cursor=args.get("cursor"),
            search=args.get("search"),
            task_id=_filter_task_id(args),
            series_id=_filter_series_id(args),
            hard_cap=CALENDAR_RESULT_HARD_CAP,
        )
    except ValueError as exc:
        return {"error": str(exc)}
    result["items"] = active_timeline_items(result.get("items") or [])
    return result


async def _tool_get(db: Database, args: dict[str, Any]) -> dict[str, Any]:
    event_id = arg(args, "id", "eventId", "event_id")
    if not event_id:
        return {"error": "id is required"}
    item = await get_event(db, event_id=str(event_id))
    if item is None or item.get("dismissed"):
        return {"error": f"event not found: {event_id}", "item": None}
    return {"item": item}


__all__ = [
    "_tool_get",
    "_tool_list_calendars",
    "_tool_recent",
    "_tool_upcoming",
    "_tool_window",
]

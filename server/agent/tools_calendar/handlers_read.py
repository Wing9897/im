"""Calendar tool handlers — read path (list / query / get)."""

from __future__ import annotations

from typing import Any

from server.agent.tool_args import arg, as_optional_int
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
from server.calendar.timeline_dismissals import active_timeline_items
from server.db.database import Database


async def _tool_list_calendars(db: Database, args: dict[str, Any]) -> dict[str, Any]:
    project_id = args.get("_agent_scope_task_id") or arg(args, "taskId", "task_id")
    items = await list_calendars(db)
    if project_id:
        pid = str(project_id).strip()
        # Project tick: only this project row + its child recurring tasks.
        scoped: list[dict[str, Any]] = []
        child_ids = {
            str(r["id"])
            for r in await db.fetch_all(
                "SELECT task_id AS id FROM recurring_schedules WHERE parent_task_id = ?",
                (pid,),
            )
        }
        for item in items:
            iid = str(item.get("id") or "")
            if iid == pid or iid in child_ids:
                scoped.append(item)
        # Ensure the project itself appears even if list_calendars omitted it.
        if not any(str(i.get("id")) == pid for i in scoped):
            row = await db.fetch_one(
                "SELECT id, name, analysis_mode, is_active, NULL AS rrule, NULL AS event_location, "
                "NULL AS event_description, 0 AS event_is_all_day, NULL AS event_start_time, "
                "NULL AS event_end_time, NULL AS event_timezone FROM analysis_tasks WHERE id = ?",
                (pid,),
            )
            if row is not None:
                scoped.insert(
                    0,
                    {
                        "id": str(row["id"]),
                        "name": str(row.get("name") or ""),
                        "analysisMode": str(row.get("analysis_mode") or ""),
                        "isActive": bool(row.get("is_active")),
                        "rrule": row.get("rrule"),
                        "location": row.get("event_location"),
                        "description": row.get("event_description"),
                        "isAllDay": bool(row.get("event_is_all_day")),
                        "eventStartTime": row.get("event_start_time"),
                        "eventEndTime": row.get("event_end_time"),
                        "timezone": row.get("event_timezone"),
                    },
                )
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
        task_id=arg(args, "taskId", "task_id"),
        hard_cap=CALENDAR_RESULT_HARD_CAP,
    )
    result["items"] = active_timeline_items(result.get("items") or [])
    return result


async def _tool_recent(db: Database, args: dict[str, Any]) -> dict[str, Any]:
    result = await query_recent(
        db,
        limit=as_optional_int(args.get("limit"), CALENDAR_DEFAULT_LIST_LIMIT) or CALENDAR_DEFAULT_LIST_LIMIT,
        search=args.get("search"),
        task_id=arg(args, "taskId", "task_id"),
        hard_cap=CALENDAR_RESULT_HARD_CAP,
    )
    result["items"] = active_timeline_items(result.get("items") or [])
    return result


async def _tool_window(db: Database, args: dict[str, Any]) -> dict[str, Any]:
    # LLM-facing aliases: start/end; Results-shape aliases: startTime/endTime.
    start = arg(args, "start", "startTime")
    end = arg(args, "end", "endTime")
    if not start or not end:
        return {"error": "start and end are required (ISO-8601)"}
    try:
        result = await query_window(
            db,
            start=str(start),
            end=str(end),
            limit=as_optional_int(args.get("limit"), CALENDAR_DEFAULT_WINDOW_LIMIT) or CALENDAR_DEFAULT_WINDOW_LIMIT,
            cursor=args.get("cursor"),
            search=args.get("search"),
            task_id=arg(args, "taskId", "task_id"),
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

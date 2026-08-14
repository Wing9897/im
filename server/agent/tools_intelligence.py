"""Local analysis-event (intelligence / intel-event) search tools for the Agent."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from typing import Any

from server.agent.tool_args import arg, as_int, as_optional_bool, as_optional_str
from server.agent.tool_limits import (
    INTELLIGENCE_DEFAULT_RESULT_LIMIT,
    INTELLIGENCE_RESULT_HARD_CAP,
)
from server.calendar.timeline_dismissals import attach_dismissed_flag
from server.calendar.timeline_importance import attach_important_flag
from server.db.database import Database
from server.queries.results_queries import query_analysis_events
from server.time_iso import to_iso_z
from server.wire.serializers import serialize_analysis_event

# Alias retained for tests and external imports.
HARD_CAP = INTELLIGENCE_RESULT_HARD_CAP
MAX_SEARCH_LENGTH = 500
BODY_TRUNCATE = 400
DEFAULT_LOOKBACK_DAYS = 7

ToolHandler = Callable[[Database, dict[str, Any]], Awaitable[dict[str, Any]]]


def _wants_all_time(args: dict[str, Any]) -> bool:
    if as_optional_bool(arg(args, "allTime", "all_time")):
        return True
    token = as_optional_str(arg(args, "timeRange", "time_range"))
    return bool(token and token.lower() == "all")


def _default_start_date() -> str:
    return to_iso_z(datetime.now(UTC) - timedelta(days=DEFAULT_LOOKBACK_DAYS))


def _compact_event(item: dict[str, Any]) -> dict[str, Any]:
    body = str(item.get("body") or "")
    if len(body) > BODY_TRUNCATE:
        body = body[: BODY_TRUNCATE - 1] + "…"
    return {
        "id": item.get("id"),
        "taskId": item.get("taskId"),
        "taskName": item.get("taskName"),
        "title": item.get("title") or "",
        "body": body,
        "startTime": item.get("startTime"),
        "endTime": item.get("endTime"),
        "location": item.get("location"),
        "createdAt": item.get("createdAt"),
        "sourcePlatform": item.get("sourcePlatform"),
        "sourceChannelName": item.get("sourceChannelName"),
        "dismissed": bool(item.get("dismissed")),
        "important": bool(item.get("important")),
    }


async def _tool_search_events(db: Database, args: dict[str, Any]) -> dict[str, Any]:
    query_text = as_optional_str(arg(args, "query", "q", "search"))
    if query_text is not None and len(query_text) > MAX_SEARCH_LENGTH:
        return {
            "error": f"query must not exceed {MAX_SEARCH_LENGTH} characters",
            "items": [],
            "count": 0,
        }
    time_range = as_optional_str(arg(args, "timeRange", "time_range"))
    if time_range and time_range.lower() != "all":
        return {
            "error": "timeRange only accepts 'all'; use startDate/endDate for bounded windows",
            "items": [],
            "count": 0,
        }

    limit = min(
        max(as_int(args.get("limit"), INTELLIGENCE_DEFAULT_RESULT_LIMIT), 1),
        INTELLIGENCE_RESULT_HARD_CAP,
    )
    offset = max(as_int(args.get("offset"), 0), 0)
    task_id = as_optional_str(arg(args, "taskId", "task_id"))
    start_date = as_optional_str(arg(args, "startDate", "start_date"))
    end_date = as_optional_str(arg(args, "endDate", "end_date"))
    all_time = _wants_all_time(args)
    if start_date is None and end_date is None and not all_time:
        start_date = _default_start_date()
    has_time = as_optional_bool(arg(args, "hasTime", "has_time"))
    search_location = bool(as_optional_bool(arg(args, "searchLocation", "search_location")) or False)
    sort_raw = (as_optional_str(args.get("sort")) or "analyzed_at").strip().lower()
    sort = sort_raw if sort_raw in ("event_time", "analyzed_at") else "analyzed_at"

    rows, total_count = await query_analysis_events(
        db,
        task_id=task_id,
        search=query_text,
        start_date=start_date,
        end_date=end_date,
        sort=sort,
        limit=limit,
        offset=offset,
        has_time=has_time,
        has_coords=None,
        search_location=search_location,
        ascending=False,
        include_total=True,
    )
    items = [serialize_analysis_event(row) for row in rows]
    await attach_dismissed_flag(db, source="analysis", items=items)
    await attach_important_flag(db, source="analysis", items=items)
    compact = [_compact_event(item) for item in items]
    return {
        "items": compact,
        "count": len(compact),
        "totalCount": total_count,
        "hasMore": offset + len(compact) < total_count,
        "limit": limit,
        "offset": offset,
        "sort": sort,
        "startDate": start_date,
        "endDate": end_date,
        "allTime": all_time,
    }


TOOL_HANDLERS: dict[str, ToolHandler] = {
    "intelligence.search_events": _tool_search_events,
}

TOOL_NAMES = frozenset(TOOL_HANDLERS)

TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "name": "intelligence.search_events",
        "description": (
            "Search analyzed intelligence / key events in SQLite (LIKE on title/body; "
            "optional location). Includes events without startTime (unlike calendar.*). "
            "Soft-dismiss only affects the timeline; dismissed=true means hidden on "
            "timeline but still listed here. Omit query to list recent events. "
            "When startDate/endDate are both omitted, applies a last-7-days lower bound "
            "(by sort field; default analyzed_at). Pass allTime=true or timeRange=all "
            "to skip that default window. When the user asks about today, pass that "
            "day's startDate/endDate. Do not invent events. Limit always applies "
            f"(default {INTELLIGENCE_DEFAULT_RESULT_LIMIT}, "
            f"max {INTELLIGENCE_RESULT_HARD_CAP})."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "Optional LIKE keyword on title/body (and location if searchLocation)",
                },
                "taskId": {
                    "type": "string",
                    "description": "Optional analysis task id filter",
                },
                "startDate": {
                    "type": "string",
                    "description": (
                        "Optional ISO lower bound for event/analyzed time. "
                        "Auto-filled to now−7d when both dates omitted and not allTime."
                    ),
                },
                "endDate": {
                    "type": "string",
                    "description": "Optional ISO upper bound for event/analyzed time",
                },
                "allTime": {
                    "type": "boolean",
                    "description": (
                        "If true, do not auto-apply the last-7-days window when dates "
                        "are omitted (full library + limit)."
                    ),
                },
                "timeRange": {
                    "type": "string",
                    "enum": ["all"],
                    "description": "Same effect as allTime=true when set to all",
                },
                "hasTime": {
                    "type": "boolean",
                    "description": "If true, only timed events; if false, only untimed key events",
                },
                "searchLocation": {
                    "type": "boolean",
                    "description": "Also match location with query (default false)",
                },
                "sort": {
                    "type": "string",
                    "enum": ["analyzed_at", "event_time"],
                    "description": "Default analyzed_at (recent intelligence first)",
                },
                "limit": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": INTELLIGENCE_RESULT_HARD_CAP,
                },
                "offset": {
                    "type": "integer",
                    "minimum": 0,
                },
            },
            "additionalProperties": False,
        },
    },
]


async def execute_intelligence_tool(db: Database, name: str, arguments: dict[str, Any] | None) -> dict[str, Any]:
    handler = TOOL_HANDLERS.get(name)
    if handler is None:
        return {"error": f"unknown tool: {name}"}
    return await handler(db, arguments or {})

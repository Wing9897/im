"""LLM-facing JSON schemas for calendar read tools."""

from __future__ import annotations

from typing import Any

from server.agent.tool_limits import (
    CALENDAR_DEFAULT_LIST_LIMIT,
    CALENDAR_DEFAULT_WINDOW_LIMIT,
    CALENDAR_RESULT_HARD_CAP,
)
from server.calendar.query import HORIZON_DAYS

_TASK_ID = {
    "type": "string",
    "description": (
        "Filter analysis events and user-event provenance by analysis task id. "
        "Not a recurring series id — use seriesId for RRULE series."
    ),
}

_SERIES_ID = {
    "type": "string",
    "description": (
        "Filter RRULE occurrences by recurring series id (or parent agent task id "
        "to include that project's child series). Not an analysis task provenance filter."
    ),
}

READ_TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "name": "calendar.list_calendars",
        "description": (
            "List calendar metadata rows (no event bodies): analysis tasks "
            "(kind=analysis_task, source=analysis) and standalone recurring "
            "series (kind=recurring_series, source=recurring). Default omits "
            "paused series (isActive=false); pass includeInactive=true to find "
            "paused series before update_recurring_series(isActive=true)."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "includeInactive": {
                    "type": "boolean",
                    "description": (
                        "When true, include paused recurring series "
                        "(isActive=false). Default false."
                    ),
                },
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "calendar.upcoming",
        "description": (
            f"Summarize upcoming events from the server clock (default limit "
            f"{CALENDAR_DEFAULT_LIST_LIMIT}, max {CALENDAR_RESULT_HARD_CAP}). "
            "For relative questions like「未來7天/這週」, ALWAYS use this with days=7 "
            "(do NOT invent UTC start/end via calendar.window — timezone mistakes miss events)."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "minimum": 1, "maximum": CALENDAR_RESULT_HARD_CAP},
                "days": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": HORIZON_DAYS,
                    "description": "Look-ahead days from now (e.g. 7 for 未來一週)",
                },
                "search": {"type": "string", "description": "Optional title/location filter"},
                "taskId": _TASK_ID,
                "seriesId": _SERIES_ID,
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "calendar.recent",
        "description": (
            f"Summarize recent past events (default limit {CALENDAR_DEFAULT_LIST_LIMIT}, "
            f"max {CALENDAR_RESULT_HARD_CAP})."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "limit": {"type": "integer", "minimum": 1, "maximum": CALENDAR_RESULT_HARD_CAP},
                "search": {"type": "string"},
                "taskId": _TASK_ID,
                "seriesId": _SERIES_ID,
            },
            "additionalProperties": False,
        },
    },
    {
        "name": "calendar.window",
        "description": (
            f"List events in an inclusive [start, end] window (default "
            f"{CALENDAR_DEFAULT_WINDOW_LIMIT}, max {CALENDAR_RESULT_HARD_CAP}). "
            "Use only for absolute dates the user named. Prefer calendar.upcoming+days "
            "for「未來 N 天」. Date-only end means end of that UTC day."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "start": {
                    "type": "string",
                    "description": "ISO-8601 start (required; alias of startTime)",
                },
                "end": {
                    "type": "string",
                    "description": ("ISO-8601 end (required; alias of endTime); date-only = end of that day UTC"),
                },
                "limit": {"type": "integer", "minimum": 1, "maximum": CALENDAR_RESULT_HARD_CAP},
                "cursor": {"type": "string", "description": "Opaque offset cursor from nextCursor"},
                "search": {"type": "string"},
                "taskId": _TASK_ID,
                "seriesId": _SERIES_ID,
            },
            "required": ["start", "end"],
            "additionalProperties": False,
        },
    },
    {
        "name": "calendar.get",
        "description": (
            "Fetch one event by id (analysis event id, user event id, RRULE "
            "occurrence id, or item remind DATE projection id `item:{id}:remind`)."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
            },
            "required": ["id"],
            "additionalProperties": False,
        },
    },
]

__all__ = ["READ_TOOL_SCHEMAS"]

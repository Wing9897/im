"""LLM-facing JSON schemas for the calendar tools.

Wording here is prompt engineering: it is what steers the model toward
``calendar.upcoming`` instead of hand-rolled UTC windows, so edit it with the
same care as ``server/prompts``.
"""

from __future__ import annotations

from typing import Any

from server.agent.tool_limits import (
    CALENDAR_DEFAULT_LIST_LIMIT,
    CALENDAR_DEFAULT_WINDOW_LIMIT,
    CALENDAR_RESULT_HARD_CAP,
)
from server.calendar.query import HORIZON_DAYS

TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "name": "calendar.list_calendars",
        "description": "List queryable calendar/event task metadata (no event bodies).",
        "parameters": {
            "type": "object",
            "properties": {},
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
                "taskId": {"type": "string"},
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
                "taskId": {"type": "string"},
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
                "taskId": {"type": "string"},
            },
            "required": ["start", "end"],
            "additionalProperties": False,
        },
    },
    {
        "name": "calendar.get",
        "description": ("Fetch one event by id (analysis event id, user event id, or RRULE occurrence id)."),
        "parameters": {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
            },
            "required": ["id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "calendar.create_event",
        "description": (
            "Create a one-off user event (no RRULE). For recurring schedules "
            "(每週三／daily／monthly), use calendar.create_recurring_task instead. "
            "Optional worksetId attaches ownership to a workset (builtin __user__ = 一般). "
            "Optional taskId keeps analysis-task provenance only. "
            "Confirm title and startTime with the user "
            "in natural language before calling. Never invent times the user did not confirm."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "startTime": {
                    "type": "string",
                    "description": (
                        "ISO-8601 start with timezone (required). "
                        "Resolve relative dates from the system prompt clock; never invent old years."
                    ),
                },
                "endTime": {
                    "type": "string",
                    "description": "ISO-8601 end with timezone (optional)",
                },
                "body": {"type": "string"},
                "location": {"type": "string"},
                "worksetId": {
                    "type": "string",
                    "description": ("Optional ownership workset id, or __user__ for builtin 一般 workset"),
                },
                "taskId": {
                    "type": "string",
                    "description": (
                        "Optional analysis-task provenance (event/recurring/project); omit when unassigned"
                    ),
                },
            },
            "required": ["title", "startTime"],
            "additionalProperties": False,
        },
    },
    {
        "name": "calendar.create_recurring_task",
        "description": (
            "Create a NEW recurring task with RRULE so recurring occurrences appear "
            "on the timeline (e.g. 每週三 10:00 → rrule=FREQ=WEEKLY;BYDAY=WE, "
            "eventStartTime=10:00). Hard-locked to analysisMode=recurring: never creates "
            "leaderboard/event/AI analysis tasks. To change or remove an existing "
            "recurring task use calendar.update_recurring_task / delete_recurring_task. "
            "Confirm name, recurrence, and clock time with the user before calling."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Task / occurrence title (alias: title)",
                },
                "rrule": {
                    "type": "string",
                    "description": (
                        "RFC 5545 RRULE body without RRULE: prefix (required). Examples: "
                        "FREQ=WEEKLY;BYDAY=WE ; FREQ=DAILY ; FREQ=MONTHLY;BYMONTHDAY=1"
                    ),
                },
                "eventStartTime": {
                    "type": "string",
                    "description": (
                        "Occurrence clock as HH:MM in the host system timezone "
                        "(preferred; same as the task form), or ISO (converted to "
                        "local clock). Required unless eventIsAllDay. Wire times "
                        "after expansion are UTC."
                    ),
                },
                "eventEndTime": {
                    "type": "string",
                    "description": "Optional end clock HH:MM (system local) or ISO",
                },
                "eventIsAllDay": {
                    "type": "boolean",
                    "description": "If true, ignore start/end clock times",
                },
                "eventLocation": {"type": "string"},
                "eventDescription": {"type": "string"},
                "location": {"type": "string", "description": "Alias of eventLocation"},
                "body": {"type": "string", "description": "Alias of eventDescription"},
                "title": {"type": "string", "description": "Alias of name"},
            },
            "required": ["rrule"],
            "additionalProperties": False,
        },
    },
    {
        "name": "calendar.update_recurring_task",
        "description": (
            "Update an EXISTING analysisMode=recurring task (name, rrule, clock times, "
            "location, description, isActive). Refuses leaderboard/event/AI tasks. "
            "For deactivate/soft-delete prefer calendar.delete_recurring_task; use isActive "
            "mainly to re-activate (true). Confirm changes with the user. Prefer "
            "calendar.list_calendars to resolve id."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Calendar task id (aliases: taskId)",
                },
                "name": {"type": "string", "description": "Task / occurrence title"},
                "title": {"type": "string", "description": "Alias of name"},
                "rrule": {
                    "type": "string",
                    "description": "RFC 5545 RRULE body without RRULE: prefix",
                },
                "eventStartTime": {
                    "type": "string",
                    "description": "HH:MM system-local (or ISO); required unless all-day",
                },
                "eventEndTime": {"type": "string"},
                "eventIsAllDay": {"type": "boolean"},
                "eventLocation": {"type": "string"},
                "eventDescription": {"type": "string"},
                "location": {"type": "string"},
                "body": {"type": "string"},
                "isActive": {
                    "type": "boolean",
                    "description": (
                        "Prefer true to re-activate a soft-deleted series. "
                        "For deactivate prefer calendar.delete_recurring_task "
                        "(false here is equivalent but not preferred)."
                    ),
                },
            },
            "required": ["id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "calendar.delete_recurring_task",
        "description": (
            "Preferred way to deactivate/soft-delete an analysisMode=recurring task "
            "(sets isActive=false; hides the RRULE series; row kept). Prefer this over "
            "update_recurring_task(isActive=false). Re-activate later via "
            "update_recurring_task with isActive=true. Refuses other task modes. "
            "Confirm before deactivating."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Calendar task id (aliases: taskId)",
                },
            },
            "required": ["id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "calendar.update_event",
        "description": (
            "Update a user event created via calendar.create_event or the timeline UI "
            "(source=user). Do not use on analysis or RRULE items."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "id": {"type": "string"},
                "title": {"type": "string"},
                "startTime": {"type": "string"},
                "endTime": {"type": "string"},
                "body": {"type": "string"},
                "location": {"type": "string"},
                "taskId": {
                    "type": "string",
                    "description": (
                        "Optional analysis-task provenance "
                        "(event/recurring/project); empty string clears provenance. "
                        "Never pass __user__ (that is a workset id)."
                    ),
                },
                "worksetId": {
                    "type": "string",
                    "description": ("Optional ownership workset id, or __user__ for builtin 一般 workset"),
                },
            },
            "required": ["id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "calendar.delete_event",
        "description": (
            "Soft-dismiss a timeline event by id (user event, analysis event, or "
            "single RRULE occurrence id). The source row is kept; restore only via "
            "the timeline UI (「顯示已移除」). Agent list/get hide dismissed items. "
            "Affects timeline only (intelligence feed still shows analysis events)."
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
    {
        "name": "calendar.mark_important",
        "description": (
            "Mark a timeline event as important (❗). Works for user events, "
            "analysis findings, RRULE occurrence ids, and item DATE projections "
            "(purchased/remind/expires). Idempotent."
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
    {
        "name": "calendar.unmark_important",
        "description": (
            "Clear the important (❗) marker from a timeline event. Same id "
            "vocabulary as calendar.mark_important / calendar.delete_event."
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

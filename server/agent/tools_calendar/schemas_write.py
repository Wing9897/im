"""LLM-facing JSON schemas for calendar write tools."""

from __future__ import annotations

from typing import Any

WRITE_TOOL_SCHEMAS: list[dict[str, Any]] = [
    {
        "name": "calendar.create_event",
        "description": (
            "Create a one-off user event (no RRULE). Always creates kind=normal "
            "(generic timeline event) — never expires or purchase_effective, and "
            "never amount/direction. Special linked-calendar kinds are Items UI only. "
            "For recurring schedules (每週三／daily／monthly), use "
            "calendar.create_recurring_series instead. "
            "Optional worksetId attaches ownership to a workset (builtin __general__ = 一般). "
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
                    "description": ("Optional ownership workset id, or __general__ for builtin 一般 workset"),
                },
                "taskId": {
                    "type": "string",
                    "description": ("Optional analysis-task provenance (intel_event / agent); omit when unassigned"),
                },
            },
            "required": ["title", "startTime"],
            "additionalProperties": False,
        },
    },
    {
        "name": "calendar.create_recurring_series",
        "description": (
            "Create a NEW standalone recurring calendar series so occurrences appear "
            "on the timeline (e.g. 每週三 10:00 → rrule=FREQ=WEEKLY;BYDAY=WE, "
            "eventStartTime=10:00). This never creates an analysis task. To change or "
            "hard-delete an existing series use calendar.update_recurring_series / "
            "delete_recurring_series. "
            "Optional worksetId attaches ownership to a workset (builtin __general__ = 一般); "
            "omit to use the request/voice IO default (then __general__). "
            "Confirm name, recurrence, and clock time with the user before calling."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "Series / occurrence title (alias: title)",
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
                "worksetId": {
                    "type": "string",
                    "description": ("Optional ownership workset id, or __general__ for builtin 一般 workset"),
                },
            },
            "required": ["rrule"],
            "additionalProperties": False,
        },
    },
    {
        "name": "calendar.update_recurring_series",
        "description": (
            "Update an EXISTING standalone recurring series (name, rrule, clock times, "
            "location, description, isActive, worksetId). Analysis tasks are outside this tool. "
            "Use isActive=false to pause without deleting. Confirm changes with the user. Prefer "
            "calendar.list_calendars (includeInactive=true when resuming a paused series) to resolve id."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Recurring series id (aliases: seriesId)",
                },
                "name": {"type": "string", "description": "Series / occurrence title"},
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
                    "description": "Set false to pause the series, or true to reactivate it.",
                },
                "worksetId": {
                    "type": "string",
                    "description": ("Optional ownership workset id, or __general__ for builtin 一般 workset"),
                },
            },
            "required": ["id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "calendar.delete_recurring_series",
        "description": (
            "Hard-delete a standalone recurring series and its occurrence markers. "
            "Use update_recurring_series(isActive=false) to pause without deleting. "
            "Confirm before deleting."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "id": {
                    "type": "string",
                    "description": "Recurring series id (aliases: seriesId)",
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
                        "(intel_event / agent); empty string clears provenance. "
                        "Never pass __general__ (that is a workset id)."
                    ),
                },
                "worksetId": {
                    "type": "string",
                    "description": ("Optional ownership workset id, or __general__ for builtin 一般 workset"),
                },
            },
            "required": ["id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "calendar.delete_event",
        "description": (
            "Soft-dismiss a timeline event by id (user event, analysis event, "
            "single RRULE occurrence id, or item remind DATE projection "
            "`item:{id}:remind`). The source row is kept; restore only via "
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
            "(itemDateKind=remind only). Idempotent."
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

__all__ = ["WRITE_TOOL_SCHEMAS"]

"""Calendar tools for the Agent runtime: name → handler registry and dispatch.

Handlers live in :mod:`.handlers`, the LLM-facing JSON schemas in :mod:`.schemas`.
Importers keep using ``server.agent.tools_calendar`` for both.

``HARD_CAP`` re-exports ``CALENDAR_RESULT_HARD_CAP`` for tests／callers that
still import the short alias from this package.
"""

from __future__ import annotations

from typing import Any, Awaitable, Callable

from server.agent.tool_limits import CALENDAR_RESULT_HARD_CAP as HARD_CAP
from server.agent.tools_calendar.handlers import (
    _tool_create_event,
    _tool_create_recurring_series,
    _tool_delete_event,
    _tool_delete_recurring_series,
    _tool_get,
    _tool_list_calendars,
    _tool_mark_important,
    _tool_recent,
    _tool_unmark_important,
    _tool_upcoming,
    _tool_update_event,
    _tool_update_recurring_series,
    _tool_window,
)
from server.agent.tools_calendar.schemas import TOOL_SCHEMAS
from server.db.database import Database

ToolHandler = Callable[[Database, dict[str, Any]], Awaitable[dict[str, Any]]]

TOOL_HANDLERS: dict[str, ToolHandler] = {
    "calendar.list_calendars": _tool_list_calendars,
    "calendar.upcoming": _tool_upcoming,
    "calendar.recent": _tool_recent,
    "calendar.window": _tool_window,
    "calendar.get": _tool_get,
    "calendar.create_event": _tool_create_event,
    "calendar.create_recurring_series": _tool_create_recurring_series,
    "calendar.update_recurring_series": _tool_update_recurring_series,
    "calendar.delete_recurring_series": _tool_delete_recurring_series,
    "calendar.update_event": _tool_update_event,
    "calendar.delete_event": _tool_delete_event,
    "calendar.mark_important": _tool_mark_important,
    "calendar.unmark_important": _tool_unmark_important,
}

TOOL_NAMES = frozenset(TOOL_HANDLERS)

__all__ = [
    "HARD_CAP",
    "TOOL_HANDLERS",
    "TOOL_NAMES",
    "TOOL_SCHEMAS",
    "ToolHandler",
    "execute_calendar_tool",
]


async def execute_calendar_tool(db: Database, name: str, arguments: dict[str, Any] | None) -> dict[str, Any]:
    handler = TOOL_HANDLERS.get(name)
    if handler is None:
        return {"error": f"unknown tool: {name}"}
    return await handler(db, arguments or {})

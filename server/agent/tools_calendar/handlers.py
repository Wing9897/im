"""Calendar tool handlers façade (read + write).

Split implementation: :mod:`.handlers_read` / :mod:`.handlers_write`.
Registry and dispatch live in ``__init__``.
"""

from __future__ import annotations

from server.agent.tools_calendar.handlers_read import (
    _tool_get,
    _tool_list_calendars,
    _tool_recent,
    _tool_upcoming,
    _tool_window,
)
from server.agent.tools_calendar.handlers_write import (
    _tool_create_event,
    _tool_create_recurring_series,
    _tool_delete_event,
    _tool_delete_recurring_series,
    _tool_mark_important,
    _tool_unmark_important,
    _tool_update_event,
    _tool_update_recurring_series,
)

__all__ = [
    "_tool_create_event",
    "_tool_create_recurring_series",
    "_tool_delete_event",
    "_tool_delete_recurring_series",
    "_tool_get",
    "_tool_list_calendars",
    "_tool_mark_important",
    "_tool_recent",
    "_tool_unmark_important",
    "_tool_upcoming",
    "_tool_update_event",
    "_tool_update_recurring_series",
    "_tool_window",
]

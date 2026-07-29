"""Compatibility re-exports for calendar tool result limits.

New code should import the explicitly named policy constants from
``server.agent.tool_limits``.
"""

from server.agent.tool_limits import (
    CALENDAR_DEFAULT_LIST_LIMIT,
    CALENDAR_DEFAULT_WINDOW_LIMIT,
    CALENDAR_RESULT_HARD_CAP,
)

DEFAULT_LIST_LIMIT = CALENDAR_DEFAULT_LIST_LIMIT
DEFAULT_WINDOW_LIMIT = CALENDAR_DEFAULT_WINDOW_LIMIT
HARD_CAP = CALENDAR_RESULT_HARD_CAP

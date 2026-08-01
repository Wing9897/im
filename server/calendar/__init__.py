"""Calendar domain: read／RRULE／wire-shape + user_events／timeline dismissals.

Read paths: ``query`` + ``normalize``. Write domain: ``user_events`` /
``user_events_normalize`` / ``timeline_dismissals``. Shared by Results API,
Calendar HTTP routes, and Agent tools.
"""

from server.calendar.normalize import (
    OCCURRENCE_ID_RE,
    Source,
    build_analysis_item,
    build_occurrence_item,
    build_user_item,
    clamp_limit,
    matches_search,
    parse_cursor,
)
from server.calendar.query import (
    HORIZON_DAYS,
    expand_active_calendar_occurrences,
    query_upcoming,
    query_window,
)
from server.calendar.rrule import (
    RruleValidationError,
    expand_calendar_occurrences,
    expand_task_occurrences,
    validate_rrule,
)

__all__ = [
    "HORIZON_DAYS",
    "OCCURRENCE_ID_RE",
    "RruleValidationError",
    "Source",
    "build_analysis_item",
    "build_occurrence_item",
    "build_user_item",
    "clamp_limit",
    "expand_active_calendar_occurrences",
    "expand_calendar_occurrences",
    "expand_task_occurrences",
    "matches_search",
    "parse_cursor",
    "query_upcoming",
    "query_window",
    "validate_rrule",
]

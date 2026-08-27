"""Recurring-only RRULE validation and query-time occurrence expansion.

Recurring tasks never run the LLM and never create analysis scheduler jobs. Their
RRULE is expanded only when the frontend calendar view queries a time range.
Expansion uses a fixed synthetic DTSTART anchor (never persisted) so results are
stable while scrolling.

``event_start_time`` / ``event_end_time`` as bare ``HH:MM`` are **calendar-local**
wall clocks: the pinned household IANA timezone when set, otherwise the host
system TZ (same as the assistant clock). Expanded ``startTime`` /
``endTime`` on the wire are absolute UTC (``…Z``), matching user_events and
analysis events. ICS series with a real TZID still expand in that TZID.

Implementation is split across ``rrule_validate``, ``rrule_expand_imported``,
and ``rrule_expand_synthetic``; this module remains the stable public facade.
"""

from __future__ import annotations

from datetime import UTC, datetime, tzinfo

from dateutil import rrule as du_rrule
from dateutil import tz as du_tz

from server.calendar.rrule_expand_synthetic import (
    expand_calendar_occurrences,
    expand_series_occurrences,
)
from server.calendar.rrule_validate import (
    ANCHOR_DATE,
    MAX_OCCURRENCES,
    RruleValidationError,
    validate_rrule,
)
from server.time_iso import to_iso_z

# Private module alias used by production paths and property tests via this facade.
_iso_z = to_iso_z

# Re-exported for monkeypatch compatibility (property / wallclock tests).
__all__ = [
    "ANCHOR_DATE",
    "MAX_OCCURRENCES",
    "RruleValidationError",
    "du_rrule",
    "du_tz",
    "expand_calendar_occurrences",
    "expand_series_occurrences",
    "validate_rrule",
]


def _system_tzinfo() -> tzinfo:
    """Host system timezone (same authority as assistant / analysis clocks)."""
    return datetime.now().astimezone().tzinfo or UTC

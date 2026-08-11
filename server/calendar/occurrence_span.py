"""Shared overnight / end-anchor rules for recurring calendar spans.

**Maintenance point** — change overnight behaviour here once; callers:

- ``server.services.recurring_series_writes`` (``dtend`` on write)
- ``server.calendar.rrule`` synthetic expand path (no ``event_start_local``)

Imported expand (has ``event_start_local``) uses duration from stored
``dtstart``/``dtend``, which already went through this helper on write.
"""

from __future__ import annotations

from datetime import datetime, timedelta


def roll_end_if_overnight(start: datetime, end: datetime) -> datetime:
    """If ``end`` is strictly before ``start``, roll end forward by one day.

    Wall-clock ranges like 22:00→06:00 are overnight; same-day end that sorts
    earlier than start must land on the next calendar day.
    """
    if end < start:
        return end + timedelta(days=1)
    return end

"""Pure wall-clock anchor construction for recurring schedule writes."""

from __future__ import annotations

from datetime import datetime, timedelta

from server.calendar.occurrence_span import roll_end_if_overnight


def manual_anchor(clock: str | None, *, is_all_day: bool, now: datetime | None = None) -> str:
    local_now = now or datetime.now().astimezone()
    if is_all_day:
        return local_now.date().isoformat()
    assert clock is not None
    hour, minute = (int(part) for part in clock.split(":", 1))
    return local_now.replace(hour=hour, minute=minute, second=0, microsecond=0, tzinfo=None).isoformat()


def manual_end_anchor(dtstart: str, end_clock: str | None, *, is_all_day: bool) -> str | None:
    if is_all_day:
        return (datetime.fromisoformat(dtstart) + timedelta(days=1)).date().isoformat()
    if end_clock is None:
        return None
    start = datetime.fromisoformat(dtstart)
    hour, minute = (int(part) for part in end_clock.split(":", 1))
    return roll_end_if_overnight(start, start.replace(hour=hour, minute=minute)).isoformat()

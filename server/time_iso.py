"""Shared ISO-8601 helpers for calendar / results / agent query layers."""

from __future__ import annotations

import re
from datetime import UTC, datetime
from typing import Any

_DATE_ONLY_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def parse_iso(value: Any, *, end_of_day: bool = False) -> datetime | None:
    """Parse ISO-8601 to UTC. Naive values treated as UTC.

    Date-only ``YYYY-MM-DD`` → start of that UTC day, or end-of-day when
    ``end_of_day`` is True (so an inclusive ``end`` covers the whole day).
    """
    if not isinstance(value, str) or not value.strip():
        return None
    text = value.strip()
    if _DATE_ONLY_RE.match(text):
        parsed = datetime.fromisoformat(text).replace(tzinfo=UTC)
        if end_of_day:
            return parsed.replace(hour=23, minute=59, second=59)
        return parsed
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    try:
        parsed = datetime.fromisoformat(text)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def to_iso_z(dt: datetime) -> str:
    """Format a datetime as ``YYYY-MM-DDTHH:MM:SSZ`` (UTC)."""
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def utc_now_iso() -> str:
    """Current UTC time in the same ``Z`` form as :func:`to_iso_z` (second precision)."""
    return to_iso_z(datetime.now(UTC))

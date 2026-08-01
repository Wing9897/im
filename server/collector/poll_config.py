"""Shared poll-interval normalization for RSS and IMAP collectors."""

from __future__ import annotations

MIN_POLL_INTERVAL = 60
MAX_POLL_INTERVAL = 86400
DEFAULT_POLL_INTERVAL = 300


def clamp_poll_interval(seconds: int | float | None) -> int:
    try:
        value = int(seconds)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        value = DEFAULT_POLL_INTERVAL
    return max(MIN_POLL_INTERVAL, min(MAX_POLL_INTERVAL, value))

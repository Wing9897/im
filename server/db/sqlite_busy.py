"""Shared SQLite busy/lock detection for retry logic."""

from __future__ import annotations

_SQLITE_BUSY_MARKERS = ("database is locked", "busy")


def is_sqlite_busy(exc: BaseException) -> bool:
    message = str(exc).lower()
    return any(marker in message for marker in _SQLITE_BUSY_MARKERS)

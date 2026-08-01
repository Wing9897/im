"""Exponential reconnect backoff policy for the collector layer.

Strategy: start at 1s, double after every failed attempt, cap at 60s, no
maximum retry count — keep retrying until reconnected or the account is
disabled. On success the sequence resets to 1s.
"""

from __future__ import annotations

#: Initial (and post-success reset) retry interval, in seconds.
BASE_DELAY_SECONDS: float = 1.0

#: Upper bound on the retry interval, in seconds.
MAX_DELAY_SECONDS: float = 60.0


def next_delay(
    current: float | None,
    *,
    base: float = BASE_DELAY_SECONDS,
    cap: float = MAX_DELAY_SECONDS,
) -> float:
    """Next backoff delay: ``base`` at the start, then doubled and clamped."""
    if current is None or current <= 0:
        return base
    return min(current * 2, cap)

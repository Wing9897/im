"""Per-conversation wall clock for Agent relative-date grounding.

A new chat (no client ``sessionId``) samples the host clock once. Follow-up
turns with the same ``sessionId`` reuse that frozen moment so we do not
re-inject a freshly sampled system time on every sentence.
"""

from __future__ import annotations

from datetime import datetime
from threading import Lock

_MAX_SESSIONS = 256
_lock = Lock()
_session_clocks: dict[str, datetime] = {}


def clear_session_clocks() -> None:
    """Test helper: drop all frozen conversation clocks."""
    with _lock:
        _session_clocks.clear()


def resolve_conversation_clock(
    session_id: str,
    *,
    is_new_conversation: bool,
    now: datetime | None = None,
) -> datetime:
    """Return the wall clock for this conversation.

    ``is_new_conversation`` is True when the client omitted ``sessionId``
    (UI started a fresh thread). Existing sessions reuse the stored clock.
    """
    sid = (session_id or "").strip()
    if not sid:
        raise ValueError("session_id is required")

    with _lock:
        if not is_new_conversation and sid in _session_clocks:
            return _session_clocks[sid]

        if now is None:
            moment = datetime.now().astimezone()
        elif now.tzinfo is None:
            moment = now.replace(tzinfo=datetime.now().astimezone().tzinfo)
        else:
            moment = now.astimezone()

        _session_clocks[sid] = moment
        while len(_session_clocks) > _MAX_SESSIONS:
            # Drop oldest insertion order (CPython 3.7+ dict preserves order).
            oldest = next(iter(_session_clocks))
            if oldest == sid:
                break
            del _session_clocks[oldest]
        return moment

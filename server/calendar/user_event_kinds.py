"""Special ``user_events.kind`` vocabulary (expires / purchase_effective / normal).

Applies to **item-linked** calendars: timeline ``source=user`` + ``item_id``.
Not the same as timeline ``source=item_remind`` remind projections (``itemDateKind=remind``
only; those rows are not ``user_events`` and have no ``kind``).

Calendar hierarchy (timeline ``source`` vs this ``kind``):
  analysis               → AI intel
  recurring              → calendar RRULE series
  user + no item_id      → general calendar
  user + item_id         → item-linked; ``kind`` drives expiry / finance
  item_remind            → remind projection only (≠ item-linked user events)

Title presets (到期 / Purchased / …) remain UX defaults; authority for expiry
derive-on-read and finance is ``kind``. Seeds and create payloads must set
``kind`` explicitly (no title→kind inference).

Wire／DDL SoT lives in ``server.domain.user_event_kinds`` (avoid schema↔calendar
import cycles); this module keeps normalize helpers. Title presets for Items
quick-create live on the FE (UX only; ``kind`` remains authority).
"""

from __future__ import annotations

from typing import Any

from server.domain.user_event_kinds import (
    ALL_USER_EVENT_KINDS,
    ALLOWED_USER_EVENT_KINDS,
    USER_EVENT_KIND_CHECK_SQL,
    USER_EVENT_KIND_EXPIRES,
    USER_EVENT_KIND_NORMAL,
    USER_EVENT_KIND_PURCHASE_EFFECTIVE,
    UserEventKind,
)


def normalize_user_event_kind(value: Any) -> str:
    """Wire/DB kind; blank / omitted → ``normal``."""
    if value is None or value == "":
        return USER_EVENT_KIND_NORMAL
    cleaned = str(value).strip()
    if cleaned not in ALLOWED_USER_EVENT_KINDS:
        raise ValueError(
            "kind must be 'normal', 'expires', or 'purchase_effective'",
        )
    return cleaned


def finance_allowed_for_kind(kind: str) -> bool:
    return kind == USER_EVENT_KIND_PURCHASE_EFFECTIVE


__all__ = [
    "ALLOWED_USER_EVENT_KINDS",
    "ALL_USER_EVENT_KINDS",
    "USER_EVENT_KIND_CHECK_SQL",
    "USER_EVENT_KIND_EXPIRES",
    "USER_EVENT_KIND_NORMAL",
    "USER_EVENT_KIND_PURCHASE_EFFECTIVE",
    "UserEventKind",
    "normalize_user_event_kind",
    "finance_allowed_for_kind",
]

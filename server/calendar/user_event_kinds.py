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
"""

from __future__ import annotations

from typing import Any

USER_EVENT_KIND_NORMAL = "normal"
USER_EVENT_KIND_EXPIRES = "expires"
USER_EVENT_KIND_PURCHASE_EFFECTIVE = "purchase_effective"

ALLOWED_USER_EVENT_KINDS = frozenset(
    {
        USER_EVENT_KIND_NORMAL,
        USER_EVENT_KIND_EXPIRES,
        USER_EVENT_KIND_PURCHASE_EFFECTIVE,
    }
)

#: Title presets historically used by Items quick-create「到期」 (UX only).
LINKED_EXPIRY_TITLES = frozenset({"到期", "Expires"})

#: Title presets historically used by Items purchase/effective quick-create (UX only).
LINKED_PURCHASE_EFFECTIVE_TITLES = frozenset(
    {
        "Purchased",
        "购入",
        "購入",
        "Effective",
        "生效",
    }
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

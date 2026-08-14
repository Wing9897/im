"""Single source of truth for ``user_events.kind`` vocabulary.

DDL CHECK in ``server/db/schema_domains/calendar.py`` embeds
``USER_EVENT_KIND_CHECK_SQL``.
"""

from __future__ import annotations

from typing import Final, Literal

USER_EVENT_KIND_NORMAL: Final = "normal"
USER_EVENT_KIND_EXPIRES: Final = "expires"
USER_EVENT_KIND_PURCHASE_EFFECTIVE: Final = "purchase_effective"

UserEventKind = Literal["normal", "expires", "purchase_effective"]

ALL_USER_EVENT_KINDS: Final[tuple[UserEventKind, ...]] = (
    USER_EVENT_KIND_NORMAL,
    USER_EVENT_KIND_EXPIRES,
    USER_EVENT_KIND_PURCHASE_EFFECTIVE,
)

ALLOWED_USER_EVENT_KINDS: Final[frozenset[str]] = frozenset(ALL_USER_EVENT_KINDS)

USER_EVENT_KIND_CHECK_SQL = "CHECK (kind IN ({}))".format(",".join(f"'{value}'" for value in ALL_USER_EVENT_KINDS))

"""Single source of truth for ``user_events.direction`` finance vocabulary.

DDL CHECK embeds ``USER_EVENT_DIRECTION_CHECK_SQL`` (NULL allowed).
"""

from __future__ import annotations

from typing import Final, Literal

UserEventDirection = Literal["expense", "income"]

ALL_USER_EVENT_DIRECTIONS: Final[tuple[UserEventDirection, ...]] = (
    "expense",
    "income",
)

ALLOWED_USER_EVENT_DIRECTIONS: Final[frozenset[str]] = frozenset(ALL_USER_EVENT_DIRECTIONS)

USER_EVENT_DIRECTION_CHECK_SQL = "CHECK (direction IS NULL OR direction IN ({}))".format(
    ",".join(f"'{value}'" for value in ALL_USER_EVENT_DIRECTIONS)
)

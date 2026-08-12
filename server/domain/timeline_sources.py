"""Single source of truth for timeline ``source`` vocabulary.

Used by ``timeline_dismissals`` / ``timeline_importance`` and the DDL CHECK on
``timeline_dismissals.source`` / ``timeline_importance.source``.
"""

from __future__ import annotations

from typing import Final, Literal

SOURCE_ANALYSIS: Final = "analysis"
SOURCE_USER: Final = "user"
SOURCE_RECURRING: Final = "recurring"
SOURCE_ITEM_REMIND: Final = "item_remind"

TimelineSource = Literal["analysis", "user", "recurring", "item_remind"]

ALL_TIMELINE_SOURCES: Final[tuple[TimelineSource, ...]] = (
    SOURCE_ANALYSIS,
    SOURCE_USER,
    SOURCE_RECURRING,
    SOURCE_ITEM_REMIND,
)

ALLOWED_TIMELINE_SOURCES: Final[frozenset[str]] = frozenset(ALL_TIMELINE_SOURCES)

TIMELINE_SOURCE_CHECK_SQL = "CHECK (source IN ({}))".format(
    ",".join(f"'{value}'" for value in ALL_TIMELINE_SOURCES)
)

TIMELINE_SOURCE_ERROR = (
    "source must be 'analysis', 'user', 'recurring', or 'item_remind'"
)

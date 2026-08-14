"""Single source of truth for ``sources.status`` vocabulary.

DDL CHECK in ``server/db/schema_domains/sources.py`` embeds
``SOURCE_STATUS_CHECK_SQL``.
"""

from __future__ import annotations

from typing import Final, Literal

SOURCE_STATUS_CONNECTED: Final = "connected"
SOURCE_STATUS_DISCONNECTED: Final = "disconnected"
SOURCE_STATUS_ERROR: Final = "error"

SourceStatus = Literal["connected", "disconnected", "error"]

ALL_SOURCE_STATUSES: Final[tuple[SourceStatus, ...]] = (
    SOURCE_STATUS_CONNECTED,
    SOURCE_STATUS_DISCONNECTED,
    SOURCE_STATUS_ERROR,
)

ALLOWED_SOURCE_STATUSES: Final[frozenset[str]] = frozenset(ALL_SOURCE_STATUSES)

SOURCE_STATUS_CHECK_SQL = "CHECK (status IN ({}))".format(",".join(f"'{value}'" for value in ALL_SOURCE_STATUSES))

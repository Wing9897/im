"""Single source of truth for ``items.status`` vocabulary.

DDL CHECK in ``server/db/schema_domains/items.py`` embeds
``ITEM_STATUS_CHECK_SQL``.
"""

from __future__ import annotations

from typing import Final, Literal

ITEM_STATUS_ACTIVE: Final = "active"
ITEM_STATUS_ARCHIVED: Final = "archived"

ItemStatus = Literal["active", "archived"]

ALL_ITEM_STATUSES: Final[tuple[ItemStatus, ...]] = (
    ITEM_STATUS_ACTIVE,
    ITEM_STATUS_ARCHIVED,
)

ALLOWED_ITEM_STATUSES: Final[frozenset[str]] = frozenset(ALL_ITEM_STATUSES)

ITEM_STATUS_CHECK_SQL = "CHECK (status IN ({}))".format(",".join(f"'{value}'" for value in ALL_ITEM_STATUSES))

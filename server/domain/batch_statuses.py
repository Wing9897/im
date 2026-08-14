"""Single source of truth for ``analysis_batches.status`` vocabulary.

DDL CHECK in ``server/db/schema_domains/tasks.py`` embeds
``BATCH_STATUS_CHECK_SQL``.
"""

from __future__ import annotations

from typing import Final, Literal

BATCH_STATUS_PENDING: Final = "pending"
BATCH_STATUS_PROCESSING: Final = "processing"
BATCH_STATUS_COMPLETED: Final = "completed"

BatchStatus = Literal["pending", "processing", "completed"]

ALL_BATCH_STATUSES: Final[tuple[BatchStatus, ...]] = (
    BATCH_STATUS_PENDING,
    BATCH_STATUS_PROCESSING,
    BATCH_STATUS_COMPLETED,
)

ALLOWED_BATCH_STATUSES: Final[frozenset[str]] = frozenset(ALL_BATCH_STATUSES)

BATCH_STATUS_CHECK_SQL = "CHECK (status IN ({}))".format(",".join(f"'{value}'" for value in ALL_BATCH_STATUSES))

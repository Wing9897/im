"""One-shot data migrations applied after schema baseline.

The ``_data_migrations`` ledger table is permanent so applied ids stay
recorded. Schema stamp／MigrationStep registry lives in ``server/db/migrations.py``.

Wipe-floor stamp 3: no registered content heals (``user_events.workset_id`` is
``NOT NULL DEFAULT '__user__'`` in DDL; delete_workset reassigns before delete).
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from server.db.database import Database
from server.util import utc_now_iso

MigrationFn = Callable[[Database], Awaitable[None]]

#: Active one-shot content migrations. Register as
#: ``("<unique_id>", <async fn>)``.
_MIGRATIONS: tuple[tuple[str, MigrationFn], ...] = ()


async def apply_data_migrations(db: Database) -> None:
    """Apply idempotent data migrations tracked in ``_data_migrations``."""
    await db.execute(
        """
        CREATE TABLE IF NOT EXISTS _data_migrations (
            id TEXT PRIMARY KEY,
            applied_at TEXT NOT NULL
        )
        """,
    )
    for migration_id, migrate in _MIGRATIONS:
        existing = await db.fetch_one(
            "SELECT id FROM _data_migrations WHERE id = ?",
            (migration_id,),
        )
        if existing is not None:
            continue
        await migrate(db)
        await db.execute(
            "INSERT INTO _data_migrations (id, applied_at) VALUES (?, ?)",
            (migration_id, utc_now_iso()),
        )

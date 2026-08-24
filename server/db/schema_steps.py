"""Production additive schema steps (FLOOR+1 … CURRENT).

The runner in :mod:`server.db.schema_migrate` walks this registry. Targets must
equal ``range(SCHEMA_FLOOR + 1, CURRENT_SCHEMA_VERSION + 1)`` or import fails.
"""

from __future__ import annotations

import aiosqlite

from server.db.schema_domains.system import SCHEMA_META_DDL
from server.db.schema_inspect import (
    CURRENT_SCHEMA_VERSION,
    SCHEMA_FLOOR,
    SCHEMA_SEMVER,
    SchemaEvolutionError,
)
from server.db.schema_migrate import MigrationStep

__all__ = ["SCHEMA_MIGRATIONS", "migrate_to_2"]


async def migrate_to_2(conn: aiosqlite.Connection) -> None:
    """Stamp 2: add ``schema_meta`` (public SemVer row, singleton id=1)."""
    await conn.execute(SCHEMA_META_DDL)
    await conn.execute(
        "INSERT OR IGNORE INTO schema_meta (id, schema_semver) VALUES (1, ?)",
        (SCHEMA_SEMVER,),
    )


SCHEMA_MIGRATIONS: tuple[MigrationStep, ...] = (MigrationStep(target=2, apply=migrate_to_2),)

_EXPECTED_TARGETS = tuple(range(SCHEMA_FLOOR + 1, CURRENT_SCHEMA_VERSION + 1))
_ACTUAL_TARGETS = tuple(step.target for step in SCHEMA_MIGRATIONS)
if _ACTUAL_TARGETS != _EXPECTED_TARGETS:
    raise SchemaEvolutionError(
        f"SCHEMA_MIGRATIONS targets {_ACTUAL_TARGETS} != expected {_EXPECTED_TARGETS} "
        "(programming error)"
    )

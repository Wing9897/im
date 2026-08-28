"""Production additive schema steps (FLOOR+1 … CURRENT).

The runner in :mod:`server.db.schema_migrate` walks this registry. Targets must
equal ``range(SCHEMA_FLOOR + 1, CURRENT_SCHEMA_VERSION + 1)`` or import fails.
"""

from __future__ import annotations

from server.db.schema_inspect import (
    CURRENT_SCHEMA_VERSION,
    SCHEMA_FLOOR,
    SchemaEvolutionError,
)
from server.db.schema_migrate import MigrationStep

__all__ = ["SCHEMA_MIGRATIONS"]

SCHEMA_MIGRATIONS: tuple[MigrationStep, ...] = ()

_EXPECTED_TARGETS = tuple(range(SCHEMA_FLOOR + 1, CURRENT_SCHEMA_VERSION + 1))
_ACTUAL_TARGETS = tuple(step.target for step in SCHEMA_MIGRATIONS)
if _ACTUAL_TARGETS != _EXPECTED_TARGETS:
    raise SchemaEvolutionError(
        f"SCHEMA_MIGRATIONS targets {_ACTUAL_TARGETS} != expected {_EXPECTED_TARGETS} (programming error)"
    )

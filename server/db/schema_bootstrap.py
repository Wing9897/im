"""Wipe-only schema bootstrap and validation (no migration registry).

**Naming**: this module used to be called ``migrations.py``. It was renamed to
``schema_bootstrap`` because there is **no** upgrade/migration chain — only
create-from-DDL or hard-reject. A thin ``migrations.py`` shim re-exports this
API for transitional imports.

Stamp **5** is the sole supported floor (``CURRENT_SCHEMA_VERSION``). There is
no ``SCHEMA_MIGRATIONS`` list, step runner, backup/restore path, or in-place
upgrade route. Empty databases are created from the authoritative DDL in
``schema_ddl.py`` (currently **25** tables). Exact unstamped stamp-5
fingerprints are stamped (``PRAGMA user_version=5``). Every other non-empty
schema is rejected without mutation →
``python scripts/reset_local_databases.py --apply``.

This round does **not** bump the stamp; product SemVer / git tags are decoupled
from ``SCHEMA_SEMVER`` / ``user_version``.
"""

from __future__ import annotations

import aiosqlite

from server.db.schema import DDL
from server.db.schema_inspect import (
    CURRENT_SCHEMA_FINGERPRINT,
    CURRENT_SCHEMA_VERSION,
    SCHEMA_SEMVER,
    ColumnSignature,
    ForeignKeyGroupSignature,
    IndexSignature,
    SchemaEvolutionError,
    SchemaFingerprint,
    _fingerprint_mismatch_categories,
    _require_current_structure,
    inspect_schema,
)

RESET_COMMAND = "python scripts/reset_local_databases.py --apply"

__all__ = [
    "CURRENT_SCHEMA_FINGERPRINT",
    "CURRENT_SCHEMA_VERSION",
    "RESET_COMMAND",
    "SCHEMA_SEMVER",
    "ColumnSignature",
    "ForeignKeyGroupSignature",
    "IndexSignature",
    "SchemaEvolutionError",
    "SchemaFingerprint",
    "_fingerprint_mismatch_categories",
    "_require_current_structure",
    "ensure_supported_schema",
    "inspect_schema",
]


def _reset_required(message: str) -> SchemaEvolutionError:
    return SchemaEvolutionError(f"{message}. Reset required: {RESET_COMMAND}")


async def ensure_supported_schema(conn: aiosqlite.Connection) -> None:
    """Create stamp 5 or validate it; never migrate or silently wipe data."""
    fingerprint = await inspect_schema(conn)
    version = fingerprint.version

    if not fingerprint.tables and version == 0:
        await conn.executescript(DDL)
        created = await inspect_schema(conn)
        _require_current_structure(created)
        await conn.execute(f"PRAGMA user_version={CURRENT_SCHEMA_VERSION}")
        await conn.commit()
        return

    if version == CURRENT_SCHEMA_VERSION:
        try:
            _require_current_structure(fingerprint)
        except SchemaEvolutionError as exc:
            raise _reset_required(str(exc)) from exc
        return

    if version == 0 and not _fingerprint_mismatch_categories(fingerprint):
        await conn.execute(f"PRAGMA user_version={CURRENT_SCHEMA_VERSION}")
        await conn.commit()
        return

    if version > CURRENT_SCHEMA_VERSION:
        raise _reset_required(
            f"Database schema version {version} is newer than supported version {CURRENT_SCHEMA_VERSION}"
        )
    if version == 0:
        categories = _fingerprint_mismatch_categories(fingerprint)
        detail = ", ".join(categories) if categories else "unknown structure"
        raise _reset_required(f"Unstamped database fingerprint mismatch: {detail}")
    raise _reset_required(f"Unsupported database schema version {version}; stamp {CURRENT_SCHEMA_VERSION} is wipe-only")

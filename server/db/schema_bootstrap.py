"""Schema bootstrap: create current DDL, walk FLOOR..CURRENT-1, or hard-reject.

Stamp **7** is both the schema floor (``SCHEMA_FLOOR``) and current stamp.
Empty databases are created from the authoritative domain DDL aggregated by
``schema.py``. Exact unstamped current fingerprints are stamped
(``PRAGMA user_version`` = current stamp). ``FLOOR <= version < CURRENT``
backs up once and applies additive ``SCHEMA_MIGRATIONS`` (empty while floor
equals current). Stamp 1–6 files hard-reject — backup then reset. Future
stamps (``version > CURRENT``, including retired 27/45) refuse with an
update-the-app message. Corrupt / lookalike fingerprints hard-reject with the
explicit reset command. Startup never silently deletes or rebuilds a database.

Product SemVer / git tags are decoupled from ``SCHEMA_SEMVER`` / ``user_version``.
"""

from __future__ import annotations

from pathlib import Path

import aiosqlite

from server.db.schema import DDL
from server.db.schema_inspect import (
    CURRENT_SCHEMA_FINGERPRINT,
    CURRENT_SCHEMA_VERSION,
    SCHEMA_FLOOR,
    SCHEMA_SEMVER,
    SchemaEvolutionError,
    SchemaFingerprint,
    _fingerprint_mismatch_categories,
    _require_current_structure,
    inspect_schema,
)
from server.db.schema_migrate import MigrationStep, apply_migrations
from server.db.schema_steps import SCHEMA_MIGRATIONS

RESET_COMMAND = "python scripts/reset_local_databases.py --apply"

__all__ = [
    "CURRENT_SCHEMA_FINGERPRINT",
    "CURRENT_SCHEMA_VERSION",
    "SCHEMA_MIGRATIONS",
    "SCHEMA_SEMVER",
    "SchemaEvolutionError",
    "SchemaFingerprint",
    "apply_authoritative_ddl",
    "ensure_supported_schema",
    "inspect_schema",
]


def _reset_required(message: str) -> SchemaEvolutionError:
    return SchemaEvolutionError(f"{message}. Reset required: {RESET_COMMAND}")


def _future_stamp_required(version: int) -> SchemaEvolutionError:
    return SchemaEvolutionError(
        f"Unsupported database schema version {version}; "
        f"this application supports stamp {CURRENT_SCHEMA_VERSION}. "
        f"Update the application. Reset is a last resort: {RESET_COMMAND}"
    )


async def apply_authoritative_ddl(conn: aiosqlite.Connection) -> None:
    """Create current tables from DDL (including ``schema_meta`` seed) and stamp.

    Does not commit. Shared by empty-DB bootstrap and explicit rebuild.
    """
    await conn.executescript(DDL)
    created = await inspect_schema(conn)
    _require_current_structure(created)
    await conn.execute(f"PRAGMA user_version={CURRENT_SCHEMA_VERSION}")


async def ensure_supported_schema(
    conn: aiosqlite.Connection,
    db_path: str | Path,
    *,
    migrations: tuple[MigrationStep, ...] | None = None,
) -> None:
    """Create the current stamp, migrate FLOOR..CURRENT-1, or reject without wipe."""
    fingerprint = await inspect_schema(conn)
    version = fingerprint.version

    if not fingerprint.tables and version == 0:
        await apply_authoritative_ddl(conn)
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

    if SCHEMA_FLOOR <= version < CURRENT_SCHEMA_VERSION:
        await apply_migrations(
            conn,
            version,
            CURRENT_SCHEMA_VERSION,
            db_path=db_path,
            migrations=SCHEMA_MIGRATIONS if migrations is None else migrations,
        )
        migrated = await inspect_schema(conn)
        try:
            _require_current_structure(migrated)
        except SchemaEvolutionError as exc:
            raise _reset_required(str(exc)) from exc
        await conn.commit()
        return

    if version > CURRENT_SCHEMA_VERSION:
        raise _future_stamp_required(version)
    if version == 0:
        categories = _fingerprint_mismatch_categories(fingerprint)
        detail = ", ".join(categories) if categories else "unknown structure"
        raise _reset_required(f"Unstamped database fingerprint mismatch: {detail}")
    raise _reset_required(
        f"Unsupported database schema version {version}; "
        f"database is corrupt or unrecognized "
        f"(schema floor {SCHEMA_FLOOR}, current stamp {CURRENT_SCHEMA_VERSION})"
    )

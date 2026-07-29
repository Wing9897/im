"""Schema evolution entry: MigrationStep registry, stamping, ensure_supported_schema.

Fingerprint inspection lives in :mod:`server.db.schema_inspect` and is
re-exported here so existing ``from server.db.migrations import …`` call sites
stay stable. Content migrations remain in ``data_migrations.py``. See
``docs/ARCHITECTURE.md#schema-support-matrix`` for the support matrix.

Schema baseline restart: integer stamp ``1`` with empty ``SCHEMA_MIGRATIONS``.
Stamped versions other than ``0`` / ``1`` hard-reject (including legacy 2–24);
there is no in-place path from pre-restart databases. Public SemVer identity is
``SCHEMA_SEMVER`` (not PRAGMA user_version).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Awaitable, Callable, Iterable

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

# Public re-exports (call sites + tests import from this module).
__all__ = [
    "CURRENT_SCHEMA_FINGERPRINT",
    "CURRENT_SCHEMA_VERSION",
    "SCHEMA_SEMVER",
    "ColumnSignature",
    "ForeignKeyGroupSignature",
    "IndexSignature",
    "MigrationStep",
    "SCHEMA_MIGRATIONS",
    "SchemaEvolutionError",
    "SchemaFingerprint",
    "ensure_supported_schema",
    "inspect_schema",
    "migration_pending",
    "run_registered_step_validates",
    "validate_migration_registry",
    "_fingerprint_mismatch_categories",
    "_require_current_structure",
]


@dataclass(frozen=True, slots=True)
class MigrationStep:
    """One evidenced, one-version schema transition.

    No pre-v1 mutating step is registered: version-0 exact-current files are a
    compatibility classification, not a historical migration.

    Optional ``validate`` runs after the version stamp for step-specific checks
    (generic row-count / FK checks remain in the upgrade gate).
    """

    source_version: int
    target_version: int
    apply: Callable[[aiosqlite.Connection], Awaitable[None]]
    validate: Callable[[aiosqlite.Connection], Awaitable[None]] | None = None


def validate_migration_registry(
    steps: Iterable[MigrationStep],
    *,
    current_version: int = CURRENT_SCHEMA_VERSION,
) -> tuple[MigrationStep, ...]:
    """Validate and freeze an ascending, contiguous one-version registry.

    An empty registry is valid (current baseline with no pending upgrades).
    A non-empty registry must end exactly at ``current_version`` so a bumped
    ``CURRENT_SCHEMA_VERSION`` cannot ship without a complete step chain —
    otherwise prior-version databases would be rejected as unsupported instead
    of entering the upgrade gate.
    """
    registry = tuple(steps)
    sources = [step.source_version for step in registry]
    if len(sources) != len(set(sources)):
        raise ValueError("Migration registry has duplicate source versions")
    if sources != sorted(sources):
        raise ValueError("Migration registry must be ordered by source version")

    for index, step in enumerate(registry):
        if step.source_version < 0 or step.target_version != step.source_version + 1:
            raise ValueError("Migration steps must be forward one-version transitions")
        if step.target_version > current_version:
            raise ValueError("Migration target exceeds the current schema version")
        if index and step.source_version != registry[index - 1].target_version:
            raise ValueError("Migration registry source versions must be contiguous")

    if registry and registry[-1].target_version != current_version:
        raise ValueError(
            "Migration registry must end at the current schema version "
            f"(last target {registry[-1].target_version} != {current_version})"
        )
    return registry


# Checklist: docs/ARCHITECTURE.md#adding-a-migrationstep-checklist
# Empty wipe-only registry at stamp 1 (pre-restart stamps hard-reject).
SCHEMA_MIGRATIONS = validate_migration_registry(())


async def _stamp_version(conn: aiosqlite.Connection, version: int, *, commit: bool = True) -> None:
    await conn.execute(f"PRAGMA user_version={version}")
    if commit:
        await conn.commit()


def _migration_chain(
    source_version: int,
    registry: tuple[MigrationStep, ...],
) -> tuple[MigrationStep, ...]:
    """Resolve a complete chain before any mutating step can run."""
    by_source = {step.source_version: step for step in registry}
    chain: list[MigrationStep] = []
    version = source_version
    while version < CURRENT_SCHEMA_VERSION:
        step = by_source.get(version)
        if step is None:
            raise SchemaEvolutionError(f"Unsupported database schema version {source_version}")
        chain.append(step)
        version = step.target_version
    return tuple(chain)


def migration_pending(source_version: int) -> bool:
    """True when a registered schema chain exists for ``source_version``."""
    return any(step.source_version == source_version for step in SCHEMA_MIGRATIONS)


async def _apply_migration_chain(
    conn: aiosqlite.Connection,
    source_version: int,
) -> None:
    """Run an evidenced chain in order; stamp version immediately after each step.

    ``executescript`` inside a step may commit internally; steps must be
    idempotent so a crash before stamp can safely re-run on the next boot.
    Optional ``step.validate`` runs after that step's stamp.
    """
    chain = _migration_chain(source_version, SCHEMA_MIGRATIONS)
    for step in chain:
        try:
            await step.apply(conn)
            await _stamp_version(conn, step.target_version, commit=True)
            if step.validate is not None:
                await step.validate(conn)
        except BaseException:
            try:
                await conn.rollback()
            except Exception:  # noqa: BLE001 — best-effort
                pass
            raise

        if step.target_version == CURRENT_SCHEMA_VERSION:
            _require_current_structure(await inspect_schema(conn))


async def run_registered_step_validates(
    conn: aiosqlite.Connection,
    *,
    from_version: int,
    to_version: int,
) -> None:
    """Re-run ``MigrationStep.validate`` hooks for a completed version span.

    Used after stamp→validate crash recovery so version-specific checks still
    run even though ``apply`` is not re-executed.
    """
    for step in SCHEMA_MIGRATIONS:
        if step.source_version < from_version or step.target_version > to_version:
            continue
        if step.validate is not None:
            await step.validate(conn)


async def ensure_supported_schema(conn: aiosqlite.Connection) -> None:
    """Create or validate every supported schema path without data migration.

    Empty files receive DDL and are stamped only after introspection succeeds.
    Exact version-0 files are classified as unstamped current schemas and only
    receive the current-version stamp. Exact current-version files are read-only
    validated. Versions with a registered MigrationStep chain run that chain.
    Every other fingerprint/version is rejected without routine recovery
    guidance.
    """
    fingerprint = await inspect_schema(conn)
    version = fingerprint.version

    if version > CURRENT_SCHEMA_VERSION:
        raise SchemaEvolutionError(
            f"Database schema version {version} is newer than supported version {CURRENT_SCHEMA_VERSION}"
        )
    if version < 0:
        raise SchemaEvolutionError(f"Unsupported database schema version {version}")

    if not fingerprint.tables and version == 0:
        await conn.executescript(DDL)
        created = await inspect_schema(conn)
        _require_current_structure(created)
        await _stamp_version(conn, CURRENT_SCHEMA_VERSION)
        return

    if version == CURRENT_SCHEMA_VERSION:
        _require_current_structure(fingerprint)
        return

    if version == 0 and not _fingerprint_mismatch_categories(fingerprint):
        await _stamp_version(conn, CURRENT_SCHEMA_VERSION)
        return

    if any(step.source_version == version for step in SCHEMA_MIGRATIONS):
        await _apply_migration_chain(conn, version)
        return

    if version == 0:
        _require_current_structure(fingerprint)
    raise SchemaEvolutionError(f"Unsupported database schema version {version}")

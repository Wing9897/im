"""Unidirectional additive schema migration runner (Joplin-style step walk).

Production steps live in :mod:`server.db.schema_steps`. Only additive SQL is
allowed: ``ADD COLUMN`` / ``CREATE TABLE`` / ``CREATE INDEX``. There is no
``down()``. Do not revive retired stamps 27/45 as a migration chain.
"""

from __future__ import annotations

import logging
import shutil
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import aiosqlite

from server.db.schema_inspect import SchemaEvolutionError

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class MigrationStep:
    """One additive upgrade that lands on ``target`` and stamps ``user_version``."""

    target: int
    apply: Callable[[aiosqlite.Connection], Awaitable[None]]


__all__ = [
    "MigrationStep",
    "apply_migrations",
    "backup_database",
]


def _index_steps(migrations: Sequence[MigrationStep]) -> dict[int, MigrationStep]:
    indexed: dict[int, MigrationStep] = {}
    for step in migrations:
        if step.target in indexed:
            raise SchemaEvolutionError(f"Duplicate migration step for stamp {step.target} (programming error)")
        indexed[step.target] = step
    return indexed


async def backup_database(
    conn: aiosqlite.Connection,
    db_path: str | Path,
    *,
    target: int,
) -> Path:
    """Checkpoint WAL, then copy the db and ``-wal``/``-shm`` sidecars beside it."""
    src = Path(db_path)
    if not src.exists():
        raise SchemaEvolutionError(f"Cannot back up missing database file: {src}")

    try:
        await conn.execute("PRAGMA wal_checkpoint(FULL)")
        await conn.commit()
    except Exception as exc:
        raise SchemaEvolutionError(f"Failed to checkpoint database before migration: {exc}") from exc

    stamp = datetime.now().strftime("%Y%m%d%H%M%S")
    dest = src.with_name(f"{src.stem}.pre-stamp-{target}.{stamp}{src.suffix}")
    try:
        shutil.copy2(src, dest)
        for suffix in ("-wal", "-shm"):
            sidecar = Path(f"{src}{suffix}")
            if sidecar.exists():
                shutil.copy2(sidecar, Path(f"{dest}{suffix}"))
    except OSError as exc:
        raise SchemaEvolutionError(f"Failed to back up database before migration: {exc}") from exc

    logger.info("Backed up database to %s before migrating to stamp %s", dest, target)
    return dest


async def apply_migrations(
    conn: aiosqlite.Connection,
    from_version: int,
    to_version: int,
    *,
    db_path: str | Path,
    migrations: Sequence[MigrationStep],
) -> None:
    """Walk ``from_version + 1 … to_version``. Back up once; each step is one transaction."""
    if from_version > to_version:
        raise SchemaEvolutionError(
            f"Cannot migrate downward from stamp {from_version} to {to_version} (programming error)"
        )
    if from_version == to_version:
        return

    indexed = _index_steps(migrations)
    needed = list(range(from_version + 1, to_version + 1))
    missing = [target for target in needed if target not in indexed]
    if missing:
        raise SchemaEvolutionError(
            f"Missing migration step(s) {missing} from stamp {from_version} to {to_version} (programming error)"
        )

    await backup_database(conn, db_path, target=to_version)

    for target in needed:
        step = indexed[target]
        try:
            await conn.execute("BEGIN IMMEDIATE")
            await step.apply(conn)
            await conn.execute(f"PRAGMA user_version={target}")
            await conn.commit()
        except Exception as exc:
            try:
                await conn.rollback()
            except Exception:
                logger.exception("Failed to roll back schema migration step %s", target)
            if isinstance(exc, SchemaEvolutionError):
                raise
            raise SchemaEvolutionError(
                f"Schema migration to stamp {target} failed; database remains at the last committed stamp"
            ) from exc
        logger.info("Applied schema migration step %s", target)

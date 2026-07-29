"""Post-migration data integrity checks (beyond schema fingerprint)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

import aiosqlite


class PostMigrationValidationError(RuntimeError):
    """Raised when migrated data fails integrity checks."""


@dataclass(frozen=True, slots=True)
class PreMigrationSnapshot:
    """Row counts captured before a stop-the-world schema upgrade."""

    schema_version: int
    analysis_tasks: int
    task_channels: int
    analysis_events: int
    analysis_batches: int
    messages: int


def _row_int(row: Any, key: str = "n") -> int:
    if row is None:
        return 0
    if isinstance(row, Mapping):
        return int(row[key])
    try:
        return int(row[key])
    except (TypeError, KeyError, IndexError):
        return int(row[0])


async def _count(conn: aiosqlite.Connection, table: str) -> int:
    row = await (await conn.execute(f"SELECT COUNT(*) AS n FROM {table}")).fetchone()
    return _row_int(row)


async def _table_exists(conn: aiosqlite.Connection, name: str) -> bool:
    row = await (
        await conn.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1",
            (name,),
        )
    ).fetchone()
    return row is not None


async def capture_pre_migration_snapshot(conn: aiosqlite.Connection) -> PreMigrationSnapshot:
    """Read counts used to verify the upgrade did not silently drop data."""
    version_row = await (await conn.execute("PRAGMA user_version")).fetchone()
    version = int(version_row[0] if version_row is not None else 0)

    async def counted(table: str) -> int:
        if await _table_exists(conn, table):
            return await _count(conn, table)
        return 0

    return PreMigrationSnapshot(
        schema_version=version,
        analysis_tasks=await counted("analysis_tasks"),
        task_channels=await counted("task_channels"),
        analysis_events=await counted("analysis_events"),
        analysis_batches=await counted("analysis_batches"),
        messages=await counted("messages"),
    )


async def validate_live_integrity(conn: aiosqlite.Connection) -> list[str]:
    """Cheap checks safe to run on every ready startup (no pre-upgrade baseline).

    Version-specific concerns belong on the corresponding
    ``MigrationStep.validate`` hook — not here.
    """
    failures: list[str] = []

    fk_rows = list(await (await conn.execute("PRAGMA foreign_key_check")).fetchall())
    if fk_rows:
        sample = fk_rows[0]
        failures.append(f"foreign_key_check reported {len(fk_rows)} violation(s); first={tuple(sample)}")

    if await _table_exists(conn, "task_channels") and await _table_exists(conn, "analysis_tasks"):
        orphan_tc = await (
            await conn.execute(
                "SELECT COUNT(*) AS n FROM task_channels tc "
                "LEFT JOIN analysis_tasks t ON t.id = tc.task_id "
                "WHERE t.id IS NULL"
            )
        ).fetchone()
        orphan_n = _row_int(orphan_tc)
        if orphan_n:
            failures.append(f"{orphan_n} orphan task_channels row(s)")

    return failures


async def validate_post_migration_data(
    conn: aiosqlite.Connection,
    before: PreMigrationSnapshot,
) -> list[str]:
    """Generic cross-version row-count comparison + live integrity.

    Version-specific checks run via ``MigrationStep.validate`` during the
    migration chain.
    """
    failures: list[str] = []
    after = await capture_pre_migration_snapshot(conn)

    if after.analysis_tasks != before.analysis_tasks:
        failures.append(f"analysis_tasks count changed ({before.analysis_tasks} → {after.analysis_tasks})")

    if after.task_channels != before.task_channels:
        failures.append(
            f"task_channels count changed ({before.task_channels} → {after.task_channels}); "
            "channel bindings must survive schema upgrade"
        )

    if after.analysis_batches != before.analysis_batches:
        failures.append(f"analysis_batches count changed ({before.analysis_batches} → {after.analysis_batches})")

    if after.messages != before.messages:
        failures.append(f"messages count changed ({before.messages} → {after.messages})")

    failures.extend(await validate_live_integrity(conn))
    return failures


async def assert_post_migration_data(
    conn: aiosqlite.Connection,
    before: PreMigrationSnapshot,
) -> None:
    failures = await validate_post_migration_data(conn, before)
    if failures:
        raise PostMigrationValidationError("; ".join(failures))


async def assert_live_integrity(conn: aiosqlite.Connection) -> None:
    failures = await validate_live_integrity(conn)
    if failures:
        raise PostMigrationValidationError("; ".join(failures))

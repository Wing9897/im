"""Housekeeping helpers for superseded analysis batch / result rows."""

from __future__ import annotations

from server.db.database import Database, SupportsExecute

_VERSIONED_RESULT_TABLES = ("trending_topics", "analysis_events", "analysis_markers")


async def delete_superseded_batches_for_task(
    db: SupportsExecute,
    task_id: str,
    current_version: int,
) -> int:
    """Delete batch rows older than the task's current version."""
    return await db.execute(
        "DELETE FROM analysis_batches WHERE task_id = ? AND version < ?",
        (task_id, current_version),
    )


async def purge_superseded_task_version_data(
    db: SupportsExecute,
    task_id: str,
    current_version: int,
) -> None:
    """After a task version bump, delete superseded result rows and batches.

    Takes ``SupportsExecute`` so the version bump and this purge can share one
    transaction (``tasks.update_task``).
    """
    for table in _VERSIONED_RESULT_TABLES:
        await db.execute(
            f"DELETE FROM {table} WHERE task_id = ? AND version < ?",  # noqa: S608 — fixed table list
            (task_id, current_version),
        )
    await delete_superseded_batches_for_task(db, task_id, current_version)


async def delete_all_superseded_batches(db: Database) -> int:
    """Delete any batch row whose version is below its task's current version."""
    return await db.execute(
        "DELETE FROM analysis_batches WHERE EXISTS ("
        "SELECT 1 FROM analysis_tasks t "
        "WHERE t.id = analysis_batches.task_id "
        "AND analysis_batches.version < t.version)"
    )


async def purge_all_superseded_version_data(db: Database) -> int:
    """Globally delete superseded result rows and batches (startup / recovery).

    Mirrors :func:`purge_superseded_task_version_data` across all tasks.
    Returns the number of deleted batch rows.
    """
    for table in _VERSIONED_RESULT_TABLES:
        await db.execute(
            f"DELETE FROM {table} WHERE EXISTS ("  # noqa: S608 — fixed table list
            "SELECT 1 FROM analysis_tasks t "
            f"WHERE t.id = {table}.task_id "
            f"AND {table}.version < t.version)"
        )
    return await delete_all_superseded_batches(db)

"""Minimal account row insertion for collector unit tests."""

from __future__ import annotations

from server.db.database import Database
from server.util import utc_now_iso


async def insert_minimal_account(
    db: Database,
    account_id: str,
    platform: str,
    *,
    name: str | None = None,
    status: str = "connected",
) -> None:
    now = utc_now_iso()
    display_name = name or f"{platform} test"
    await db.execute(
        "INSERT INTO accounts (id, platform, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        (account_id, platform, display_name, status, now, now),
    )


async def insert_legacy_analysis_task(
    db: Database,
    task_id: str,
    *,
    analysis_mode: str,
    schedule_type: str,
    schedule_value: str | None,
    rrule: str | None,
) -> None:
    """Persist an analysis task directly, bypassing API recurrence validation."""
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO analysis_tasks (id, name, prompt_template, analysis_mode, "
        "analysis_time_range, version, is_active, schedule_type, schedule_value, "
        "rrule, created_at, updated_at) VALUES (?, ?, 'Analyze', ?, 'all', 1, 1, ?, ?, ?, ?, ?)",
        (task_id, f"Legacy task {task_id}", analysis_mode, schedule_type, schedule_value, rrule, now, now),
    )

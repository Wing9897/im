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
    schedule_type: str | None = None,
    schedule_value: str | None = None,
    schedule_rrule: str | None = None,
    rrule: str | None = None,
) -> None:
    """Persist an analysis task directly, bypassing API recurrence validation."""
    from server.domain.schedule import legacy_to_trigger_rrule

    now = utc_now_iso()
    if schedule_rrule is None and schedule_type is not None:
        try:
            schedule_rrule = legacy_to_trigger_rrule(schedule_type, schedule_value)
        except Exception:
            # Preserve intentionally invalid schedules for negative registration tests.
            schedule_rrule = f"INVALID;type={schedule_type};value={schedule_value}"
    await db.execute(
        "INSERT INTO analysis_tasks (id, name, prompt_template, analysis_mode, "
        "analysis_time_range, version, is_active, schedule_rrule, "
        "created_at, updated_at) VALUES (?, ?, 'Analyze', ?, 'all', 1, 1, ?, ?, ?)",
        (task_id, f"Legacy task {task_id}", analysis_mode, schedule_rrule, now, now),
    )
    if rrule is not None:
        await db.execute(
            "INSERT INTO recurring_schedules "
            "(task_id, rrule, dtstart, timezone, created_at, updated_at) "
            "VALUES (?, ?, '2026-01-01T10:00:00', 'floating', ?, ?)",
            (task_id, rrule, now, now),
        )

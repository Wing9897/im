"""Contract: AI trigger schedules never calendar-expand; recurring still does."""

from __future__ import annotations

from datetime import datetime, timezone

from server.calendar.rrule import expand_calendar_occurrences
from server.domain.schedule import (
    legacy_to_trigger_rrule,
    may_calendar_expand,
    may_register_trigger,
)
from server.queries.calendar_queries import fetch_active_recurring_task_rows
from server.util import utc_now_iso


async def test_ai_trigger_schedule_never_appears_in_calendar_expand(app) -> None:
    """SECONDLY / HOURLY trigger RRULEs on AI modes must not become occurrences."""
    db = app.state.db
    now = utc_now_iso()
    ai_id = "gate-ai-secondly"
    recurring_id = "gate-recurring-weekly"

    await db.execute("DELETE FROM analysis_tasks WHERE id IN (?, ?)", (ai_id, recurring_id))
    await db.execute(
        "INSERT INTO analysis_tasks (id, name, prompt_template, analysis_mode, "
        "analysis_time_range, version, is_active, schedule_rrule, created_at, updated_at) "
        "VALUES (?, 'AI gate', 'Analyze', 'event', 'all', 1, 1, ?, ?, ?)",
        (ai_id, legacy_to_trigger_rrule("custom_seconds", "10"), now, now),
    )
    await db.execute(
        "INSERT INTO analysis_tasks (id, name, prompt_template, analysis_mode, "
        "analysis_time_range, version, is_active, schedule_rrule, created_at, updated_at) "
        "VALUES (?, 'Recurring gate', '', 'recurring', 'all', 1, 1, NULL, ?, ?)",
        (recurring_id, now, now),
    )
    await db.execute(
        "INSERT INTO recurring_schedules "
        "(task_id, rrule, dtstart, timezone, created_at, updated_at) "
        "VALUES (?, 'FREQ=WEEKLY;BYDAY=MO', '2026-07-06T10:00:00', 'floating', ?, ?)",
        (recurring_id, now, now),
    )

    assert may_register_trigger("event")
    assert not may_calendar_expand("event")
    assert may_calendar_expand("recurring")
    assert not may_register_trigger("recurring")

    rows = await fetch_active_recurring_task_rows(db)
    ids = {str(row["id"]) for row in rows}
    assert ai_id not in ids
    assert recurring_id in ids

    occurrences = expand_calendar_occurrences(
        rows,
        datetime(2026, 7, 1, tzinfo=timezone.utc),
        datetime(2026, 8, 1, tzinfo=timezone.utc),
    )
    occ_task_ids = {str(item["taskId"]) for item in occurrences}
    assert ai_id not in occ_task_ids
    assert recurring_id in occ_task_ids


async def test_calendar_items_http_excludes_ai_trigger_schedules(app, client) -> None:
    """GET /calendar/items must not surface AI schedule_rrule as occurrences."""
    db = app.state.db
    now = utc_now_iso()
    ai_id = "gate-http-ai"
    recurring_id = "gate-http-recurring"

    await db.execute("DELETE FROM analysis_tasks WHERE id IN (?, ?)", (ai_id, recurring_id))
    await db.execute(
        "INSERT INTO analysis_tasks (id, name, prompt_template, analysis_mode, "
        "analysis_time_range, version, is_active, schedule_rrule, created_at, updated_at) "
        "VALUES (?, 'HTTP AI', 'Analyze', 'leaderboard', 'all', 1, 1, ?, ?, ?)",
        (ai_id, "FREQ=SECONDLY;INTERVAL=10", now, now),
    )
    await db.execute(
        "INSERT INTO analysis_tasks (id, name, prompt_template, analysis_mode, "
        "analysis_time_range, version, is_active, schedule_rrule, created_at, updated_at) "
        "VALUES (?, 'HTTP Recurring', '', 'recurring', 'all', 1, 1, NULL, ?, ?)",
        (recurring_id, now, now),
    )
    await db.execute(
        "INSERT INTO recurring_schedules "
        "(task_id, rrule, dtstart, timezone, created_at, updated_at) "
        "VALUES (?, 'FREQ=DAILY', '2026-07-01T09:00:00', 'floating', ?, ?)",
        (recurring_id, now, now),
    )

    response = await client.get(
        "/api/v1/calendar/items",
        params={
            "range_start": "2026-07-01T00:00:00Z",
            "range_end": "2026-07-08T00:00:00Z",
        },
    )
    assert response.status_code == 200
    items = response.json()
    task_ids = {str(item["taskId"]) for item in items}
    assert ai_id not in task_ids
    assert recurring_id in task_ids

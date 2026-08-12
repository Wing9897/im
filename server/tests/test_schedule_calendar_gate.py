"""Contract: AI trigger schedules never calendar-expand; recurring still does."""

from __future__ import annotations

from datetime import datetime, timezone

from server.calendar.rrule import expand_calendar_occurrences
from server.domain.schedule import (
    may_calendar_expand_series,
    may_register_trigger,
    preset_to_trigger_rrule,
)
from server.llm_profiles_const import DEFAULT_LLM_PROFILE_ID
from server.queries.calendar_queries import fetch_active_recurring_series_rows
from server.util import utc_now_iso


async def test_ai_trigger_schedule_never_appears_in_calendar_expand(app) -> None:
    """SECONDLY / HOURLY trigger RRULEs on AI modes must not become occurrences."""
    db = app.state.db
    now = utc_now_iso()
    ai_id = "gate-ai-secondly"
    recurring_id = "gate-recurring-weekly"

    await db.execute("DELETE FROM analysis_tasks WHERE id = ?", (ai_id,))
    await db.execute("DELETE FROM recurring_schedules WHERE id = ?", (recurring_id,))
    await db.execute(
        "INSERT INTO analysis_tasks (id, name, prompt_template, analysis_mode, "
        "analysis_time_range, version, is_active, schedule_rrule, llm_profile_id, "
        "created_at, updated_at) "
        "VALUES (?, 'AI gate', 'Analyze', 'intel_event', 'all', 1, 1, ?, ?, ?, ?)",
        (ai_id, preset_to_trigger_rrule("custom_seconds", "10"), DEFAULT_LLM_PROFILE_ID, now, now),
    )
    await db.execute(
        "INSERT INTO recurring_schedules "
        "(id, name, workset_id, is_active, rrule, dtstart, timezone, created_at, updated_at) "
        "VALUES (?, 'Recurring gate', '__user__', 1, 'FREQ=WEEKLY;BYDAY=MO', "
        "'2026-07-06T10:00:00', 'floating', ?, ?)",
        (recurring_id, now, now),
    )

    assert may_register_trigger("intel_event")
    assert may_calendar_expand_series({"is_active": 1, "rrule": "FREQ=WEEKLY;BYDAY=MO"})
    assert not may_register_trigger("recurring")

    rows = await fetch_active_recurring_series_rows(db)
    ids = {str(row["id"]) for row in rows}
    assert ai_id not in ids
    assert recurring_id in ids

    occurrences = expand_calendar_occurrences(
        rows,
        datetime(2026, 7, 1, tzinfo=timezone.utc),
        datetime(2026, 8, 1, tzinfo=timezone.utc),
    )
    occ_series_ids = {str(item["seriesId"]) for item in occurrences}
    assert ai_id not in occ_series_ids
    assert recurring_id in occ_series_ids
    assert all("analysisMode" not in item or not item.get("analysisMode") for item in occurrences)


async def test_calendar_items_http_excludes_ai_trigger_schedules(app, client) -> None:
    """GET /calendar/items must not surface AI schedule_rrule as occurrences."""
    db = app.state.db
    now = utc_now_iso()
    ai_id = "gate-http-ai"
    recurring_id = "gate-http-recurring"

    await db.execute("DELETE FROM analysis_tasks WHERE id = ?", (ai_id,))
    await db.execute("DELETE FROM recurring_schedules WHERE id = ?", (recurring_id,))
    await db.execute(
        "INSERT INTO analysis_tasks (id, name, prompt_template, analysis_mode, "
        "analysis_time_range, version, is_active, schedule_rrule, llm_profile_id, "
        "created_at, updated_at) "
        "VALUES (?, 'HTTP AI', 'Analyze', 'leaderboard', 'all', 1, 1, ?, ?, ?, ?)",
        (ai_id, "FREQ=SECONDLY;INTERVAL=10", DEFAULT_LLM_PROFILE_ID, now, now),
    )
    await db.execute(
        "INSERT INTO recurring_schedules "
        "(id, name, workset_id, is_active, rrule, dtstart, timezone, created_at, updated_at) "
        "VALUES (?, 'HTTP Recurring', '__user__', 1, 'FREQ=DAILY', "
        "'2026-07-01T09:00:00', 'floating', ?, ?)",
        (recurring_id, now, now),
    )

    response = await client.get(
        "/api/v1/calendar/items",
        params={
            "rangeStart": "2026-07-01T00:00:00Z",
            "rangeEnd": "2026-07-08T00:00:00Z",
        },
    )
    assert response.status_code == 200
    items = response.json()
    series_ids = {str(item["seriesId"]) for item in items}
    assert ai_id not in series_ids
    assert recurring_id in series_ids
    assert all(not item.get("analysisMode") for item in items if item.get("seriesId") == recurring_id)

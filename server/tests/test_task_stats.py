"""Per-task analysis stats semantics."""

from __future__ import annotations

from server.tests import seed
from server.util import new_id, utc_now_iso


async def test_stats_pending_markers_not_counted_as_analyzed(app, client):
    """Markers on pending batches must not inflate analyzedCount."""
    db = app.state.db
    now = utc_now_iso()
    pending_batch_id = new_id()
    await db.execute(
        "INSERT INTO analysis_batches (id, task_id, version, status, message_count, "
        "retry_count, error_message, created_at, updated_at) VALUES (?, ?, 1, 'pending', 3, 0, NULL, ?, ?)",
        (pending_batch_id, seed.TASK_LEADERBOARD, now, now),
    )
    await db.execute(
        "INSERT INTO analysis_markers (id, message_id, task_id, version, batch_id, analyzed_at) "
        "VALUES (?, ?, ?, 1, ?, ?)",
        (new_id(), "msg-2", seed.TASK_LEADERBOARD, pending_batch_id, now),
    )

    resp = await client.get("/api/v1/results/stats", params={"time_range": "all"})
    lb = next(e for e in resp.json() if e["taskId"] == seed.TASK_LEADERBOARD)
    assert lb["analyzedCount"] == 1
    assert lb["queuedMessageCount"] == 3


async def test_stats_project_mode_zeros_marker_counts(app, client):
    """Project progress is cursor-based; marker stats must stay zero."""
    from server.db.database import TransactionDb
    from server.queries.tasks_queries import insert_analysis_task

    db = app.state.db
    task_id = new_id()
    now = utc_now_iso()
    async with db.transaction() as conn:
        await insert_analysis_task(
            TransactionDb(conn),
            task_id=task_id,
            name="PM stats",
            description=None,
            prompt_template="goals",
            analysis_mode="project",
            analysis_time_range="all",
            schedule_type="hourly",
            schedule_value=None,
            rrule=None,
            event_start_time=None,
            event_end_time=None,
            event_is_all_day=0,
            event_location=None,
            event_description=None,
            now=now,
        )
    await db.execute(
        "INSERT OR IGNORE INTO channels (platform, platform_id, channel_name, created_at) VALUES (?, ?, ?, ?)",
        ("rss", "feed-stats", "feed", now),
    )
    await db.execute(
        "INSERT OR IGNORE INTO task_channels (task_id, platform, platform_id) VALUES (?, ?, ?)",
        (task_id, "rss", "feed-stats"),
    )
    await db.execute(
        "INSERT INTO messages (id, platform, platform_id, content, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (new_id(), "rss", "feed-stats", "hello", now, now),
    )

    resp = await client.get("/api/v1/results/stats", params={"time_range": "all"})
    row = next(e for e in resp.json() if e["taskId"] == task_id)
    assert row["analyzedCount"] == 0
    assert row["unanalyzedCount"] == 0

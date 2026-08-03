"""Version-aware batch counts on viewer stats and results queue."""

from __future__ import annotations

from server.tests import seed
from server.util import new_id, utc_now_iso


async def test_viewer_stats_excludes_old_version_batches(client):
    before = (await client.get("/api/v1/viewer/stats")).json()
    assert before["totalBatches"] == 5
    assert before["completedBatches"] == 5

    update = await client.put(
        f"/api/v1/tasks/{seed.TASK_LEADERBOARD}",
        json={
            "name": "Leaderboard v2",
            "promptTemplate": "分析 v2",
            "analysisMode": "leaderboard",
            "analysisTimeRange": "all",
            "channelIds": [f"{seed.TG_CHANNEL[0]}:{seed.TG_CHANNEL[1]}"],
            "scheduleRrule": "FREQ=SECONDLY;INTERVAL=10",
        },
    )
    assert update.status_code == 200

    after = (await client.get("/api/v1/viewer/stats")).json()
    assert after["totalBatches"] == before["totalBatches"] - 1
    assert after["completedBatches"] == before["completedBatches"] - 1


async def test_queue_excludes_old_version_pending(app, client):
    db = app.state.db
    now = utc_now_iso()
    pending_batch_id = new_id()
    await db.execute(
        "INSERT INTO analysis_batches (id, task_id, version, status, message_count, "
        "retry_count, error_message, created_at, updated_at) VALUES (?, ?, 1, 'pending', 1, 0, NULL, ?, ?)",
        (pending_batch_id, seed.TASK_LEADERBOARD, now, now),
    )

    before = (await client.get("/api/v1/results/queue")).json()
    assert before["pendingCount"] == 1

    update = await client.put(
        f"/api/v1/tasks/{seed.TASK_LEADERBOARD}",
        json={
            "name": "Leaderboard v2 queue",
            "promptTemplate": "分析 v2",
            "analysisMode": "leaderboard",
            "analysisTimeRange": "all",
            "channelIds": [f"{seed.TG_CHANNEL[0]}:{seed.TG_CHANNEL[1]}"],
            "scheduleRrule": "FREQ=SECONDLY;INTERVAL=10",
        },
    )
    assert update.status_code == 200

    after = (await client.get("/api/v1/results/queue")).json()
    assert after["pendingCount"] == 0

    row = await db.fetch_one(
        "SELECT id FROM analysis_batches WHERE id = ?",
        (pending_batch_id,),
    )
    assert row is None


async def test_version_bump_deletes_superseded_batch_rows(app, client):
    db = app.state.db
    now = utc_now_iso()
    event_id = "event-lb-version-bump"
    await db.execute(
        "INSERT INTO analysis_events (id, task_id, version, batch_id, title, body, start_time, "
        "participants_json, content_hash, semantic_hash, event_key, location, created_at, updated_at) "
        "VALUES (?, ?, 1, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?)",
        (
            event_id,
            seed.TASK_LEADERBOARD,
            seed.BATCH_LEADERBOARD,
            "superseded event",
            "should be purged on version bump",
            now,
            "lb-bump-content-hash",
            "lb-bump-semantic-hash",
            "lb-bump-event-key",
            "N/A",
            now,
            now,
        ),
    )

    rows_before = await db.fetch_all(
        "SELECT id FROM analysis_batches WHERE task_id = ? AND version < 2",
        (seed.TASK_LEADERBOARD,),
    )
    assert {row["id"] for row in rows_before} == {seed.BATCH_LEADERBOARD}
    assert await db.fetch_all(
        "SELECT id FROM analysis_markers WHERE task_id = ? AND version < 2",
        (seed.TASK_LEADERBOARD,),
    )
    assert await db.fetch_all(
        "SELECT id FROM trending_topics WHERE task_id = ? AND version < 2",
        (seed.TASK_LEADERBOARD,),
    )
    assert await db.fetch_all(
        "SELECT id FROM analysis_events WHERE task_id = ? AND version < 2",
        (seed.TASK_LEADERBOARD,),
    )

    update = await client.put(
        f"/api/v1/tasks/{seed.TASK_LEADERBOARD}",
        json={
            "name": "Leaderboard v2 prune",
            "promptTemplate": "分析 v2",
            "analysisMode": "leaderboard",
            "analysisTimeRange": "all",
            "channelIds": [f"{seed.TG_CHANNEL[0]}:{seed.TG_CHANNEL[1]}"],
            "scheduleRrule": "FREQ=SECONDLY;INTERVAL=10",
        },
    )
    assert update.status_code == 200
    new_version = int(update.json()["version"])

    remaining_batches = await db.fetch_all(
        "SELECT id FROM analysis_batches WHERE task_id = ? AND version < ?",
        (seed.TASK_LEADERBOARD, new_version),
    )
    remaining_markers = await db.fetch_all(
        "SELECT id FROM analysis_markers WHERE task_id = ? AND version < ?",
        (seed.TASK_LEADERBOARD, new_version),
    )
    remaining_topics = await db.fetch_all(
        "SELECT id FROM trending_topics WHERE task_id = ? AND version < ?",
        (seed.TASK_LEADERBOARD, new_version),
    )
    remaining_events = await db.fetch_all(
        "SELECT id FROM analysis_events WHERE task_id = ? AND version < ?",
        (seed.TASK_LEADERBOARD, new_version),
    )
    assert remaining_batches == []
    assert remaining_markers == []
    assert remaining_topics == []
    assert remaining_events == []


async def test_startup_purge_clears_superseded_results(app):
    """recover_orphan_batches global purge matches per-task result purge."""
    db = app.state.db
    now = utc_now_iso()
    event_id = "event-lb-startup-purge"
    await db.execute(
        "INSERT INTO analysis_events (id, task_id, version, batch_id, title, body, start_time, "
        "participants_json, content_hash, semantic_hash, event_key, location, created_at, updated_at) "
        "VALUES (?, ?, 1, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?, ?)",
        (
            event_id,
            seed.TASK_LEADERBOARD,
            seed.BATCH_LEADERBOARD,
            "orphaned event",
            "should be purged on startup recovery",
            now,
            "lb-startup-content-hash",
            "lb-startup-semantic-hash",
            "lb-startup-event-key",
            "N/A",
            now,
            now,
        ),
    )
    # Bump version without going through the task API purge path.
    await db.execute(
        "UPDATE analysis_tasks SET version = 2 WHERE id = ?",
        (seed.TASK_LEADERBOARD,),
    )

    assert await db.fetch_one(
        "SELECT id FROM analysis_batches WHERE id = ?",
        (seed.BATCH_LEADERBOARD,),
    )
    assert await db.fetch_one(
        "SELECT id FROM analysis_markers WHERE task_id = ? AND version < 2",
        (seed.TASK_LEADERBOARD,),
    )
    assert await db.fetch_one(
        "SELECT id FROM trending_topics WHERE task_id = ? AND version < 2",
        (seed.TASK_LEADERBOARD,),
    )
    assert await db.fetch_one(
        "SELECT id FROM analysis_events WHERE id = ?",
        (event_id,),
    )

    await app.state.scheduler.recover_orphan_batches()

    assert (
        await db.fetch_one(
            "SELECT id FROM analysis_batches WHERE id = ?",
            (seed.BATCH_LEADERBOARD,),
        )
        is None
    )
    assert (
        await db.fetch_all(
            "SELECT id FROM analysis_markers WHERE task_id = ? AND version < 2",
            (seed.TASK_LEADERBOARD,),
        )
        == []
    )
    assert (
        await db.fetch_all(
            "SELECT id FROM trending_topics WHERE task_id = ? AND version < 2",
            (seed.TASK_LEADERBOARD,),
        )
        == []
    )
    assert (
        await db.fetch_one(
            "SELECT id FROM analysis_events WHERE id = ?",
            (event_id,),
        )
        is None
    )

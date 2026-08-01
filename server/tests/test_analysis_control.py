"""Regression tests for analysis_control: abort must release claimed markers."""

from __future__ import annotations

from server.analysis_control import delete_processing_batches
from server.analyzer.incremental import count_unanalyzed_messages
from server.tests import seed


async def _seed_processing_batch_with_markers(db, batch_id: str = "batch-abort") -> None:
    await db.execute(
        "INSERT INTO analysis_batches (id, task_id, version, status, "
        "message_count, retry_count, created_at, updated_at) "
        "VALUES (?, ?, 1, 'processing', 2, 0, ?, ?)",
        (batch_id, seed.TASK_EVENT, seed.NOW, seed.NOW),
    )
    for i, message_id in enumerate((seed.MESSAGE_1, "msg-2")):
        await db.execute(
            "INSERT INTO analysis_markers (id, message_id, task_id, version, batch_id, analyzed_at) "
            "VALUES (?, ?, ?, 1, ?, ?)",
            (f"marker-abort-{i}", message_id, seed.TASK_EVENT, batch_id, seed.NOW),
        )


async def test_delete_processing_batches_clears_markers(app):
    db = app.state.db
    await db.execute("UPDATE analysis_tasks SET analysis_time_range = 'all'")
    await _seed_processing_batch_with_markers(db)

    before = await count_unanalyzed_messages(db, {"id": seed.TASK_EVENT, "version": 1, "analysis_time_range": "all"})

    batch_ids = await delete_processing_batches(db)

    assert batch_ids == ["batch-abort"]
    row = await db.fetch_one("SELECT id FROM analysis_batches WHERE id = 'batch-abort'")
    assert row is None

    markers = await db.fetch_all("SELECT id FROM analysis_markers WHERE batch_id = 'batch-abort'")
    assert markers == []

    after = await count_unanalyzed_messages(db, {"id": seed.TASK_EVENT, "version": 1, "analysis_time_range": "all"})
    assert after == before + 2


async def test_emergency_abort_endpoint_releases_claimed_messages(client, app):
    db = app.state.db
    await db.execute("UPDATE analysis_tasks SET analysis_time_range = 'all'")
    await _seed_processing_batch_with_markers(db, batch_id="batch-abort-http")

    resp = await client.post("/api/v1/system/analysis/abort")
    assert resp.status_code == 200
    body = resp.json()
    assert body["analysisPaused"] is True
    assert "batch-abort-http" in body["abortedBatchIds"]

    markers = await db.fetch_all("SELECT id FROM analysis_markers WHERE batch_id = 'batch-abort-http'")
    assert markers == []

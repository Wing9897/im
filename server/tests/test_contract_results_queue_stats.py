"""Contract keys: results queue + stats."""

from __future__ import annotations

from server.tests import seed
from server.tests.contract_helpers import assert_keys
from server.util import new_id, utc_now_iso


async def test_queue(client):
    resp = await client.get("/api/v1/results/queue")
    body = resp.json()
    assert_keys(
        body,
        ["analysisPaused", "processingBatches", "attentionBatches", "pendingCount"],
        "queue",
    )
    assert isinstance(body["analysisPaused"], bool)
    assert isinstance(body["processingBatches"], list)
    assert isinstance(body["attentionBatches"], list)


async def test_queue_attention_batches_include_error_message(app, client):
    db = app.state.db
    now = utc_now_iso()
    batch_id = new_id()
    await db.execute(
        "INSERT INTO analysis_batches (id, task_id, version, status, message_count, "
        "retry_count, error_message, prompt_tokens, completion_tokens, created_at, updated_at) "
        "VALUES (?, ?, 1, 'pending', 2, 1, ?, 10, 5, ?, ?)",
        (batch_id, seed.TASK_LEADERBOARD, "LLM timeout", now, now),
    )

    body = (await client.get("/api/v1/results/queue")).json()
    attention = {row["batchId"]: row for row in body["attentionBatches"]}
    assert batch_id in attention
    assert attention[batch_id]["errorMessage"] == "LLM timeout"
    assert attention[batch_id]["retryCount"] == 1
    assert attention[batch_id]["promptTokens"] == 10
    assert attention[batch_id]["completionTokens"] == 5


async def test_stats(client):
    resp = await client.get("/api/v1/results/stats", params={"timeRange": "all"})
    body = resp.json()
    # Seed has five analysis_tasks (calendar series is not included).
    assert len(body) == 5
    for entry in body:
        assert_keys(
            entry,
            [
                "taskId",
                "unanalyzedCount",
                "analyzedCount",
                "queuedMessageCount",
                "triggerThreshold",
            ],
            "TaskAnalysisStats",
        )
        assert isinstance(entry["triggerThreshold"], int)
        assert entry["triggerThreshold"] >= 1

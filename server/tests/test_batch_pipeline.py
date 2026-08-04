"""End-to-end batch pipeline with a stub LLM engine.

Covers: marker claiming → prompt build → analyze → result persistence →
SSE lifecycle events → incremental re-run (no double analysis) → failure path.
"""

from __future__ import annotations

from typing import Any

import pytest

from server.analyzer.incremental import fetch_unanalyzed_messages
from server.config import set_configs
from server.scheduler.batch import _process_batch, execute_batch
from server.scheduler.batch_claim import create_batch_with_markers, load_task
from server.tests import seed


class StubEngine:
    provider = "stub"
    model = "stub-model"

    def __init__(self, items: list[dict[str, Any]] | Exception):
        self._items = items
        self.calls = 0

    async def analyze(self, prompt: Any) -> dict[str, Any]:
        self.calls += 1
        if isinstance(self._items, Exception):
            raise self._items
        return {"items": self._items, "prompt_tokens": 42, "completion_tokens": 7}


class RecordingBroadcaster:
    def __init__(self) -> None:
        self.events: list[tuple[str, dict]] = []

    def publish(self, event_type: str, payload: dict) -> None:
        self.events.append((event_type, payload))

    def types(self) -> list[str]:
        return [e[0] for e in self.events]


@pytest.fixture
async def db(app):
    database = app.state.db
    # Make every unanalyzed message eligible immediately. The seeded message
    # timestamps are fixed dates, so widen the analysis window to 'all'.
    await set_configs(
        database,
        {"analysis_trigger_threshold": "1", "analysis_batch_message_limit": "50"},
    )
    await database.execute("UPDATE analysis_tasks SET analysis_time_range = 'all'")
    return database


async def test_leaderboard_batch_end_to_end(db):
    engine = StubEngine(
        [
            {
                "topic": "地震討論",  # exists from seed → upsert, not duplicate
                "score": 0.95,
                "summary": "updated summary",
                "related_message_ids": ["msg-2", "hallucinated-id"],
            },
            {"topic": "新話題", "score": 0.5, "summary": "brand new"},
        ]
    )
    broadcaster = RecordingBroadcaster()

    await execute_batch(
        db=db,
        broadcaster=broadcaster,
        task_id=seed.TASK_LEADERBOARD,
        analysis_engine=engine,
        action_executor=None,
    )

    assert engine.calls == 1
    assert broadcaster.types() == [
        "analysis_started",
        "analysis_completed",
    ]
    completed = broadcaster.events[1][1]
    assert completed["analysisMode"] == "leaderboard"
    assert completed["findingsCount"] == 2
    assert completed["hasFindings"] is True

    # Board accumulated: seed had 2 topics, one was upserted, one added.
    topics = await db.fetch_all(
        "SELECT topic_name, rank, score FROM trending_topics WHERE task_id = ? AND version = 1 ORDER BY rank ASC",
        (seed.TASK_LEADERBOARD,),
    )
    names = {t["topic_name"] for t in topics}
    assert names == {"地震討論", "演唱會", "新話題"}
    assert [t["rank"] for t in topics] == [1, 2, 3]
    assert topics[0]["topic_name"] == "地震討論"
    assert topics[0]["score"] == 0.95

    # Related messages replace prior links; hallucinated ids are skipped.
    links = await db.fetch_all(
        "SELECT tm.message_id FROM topic_messages tm "
        "JOIN trending_topics tt ON tt.id = tm.topic_id "
        "WHERE tt.topic_name = '地震討論'"
    )
    assert {row["message_id"] for row in links} == {"msg-2"}

    # Incremental invariant: a second run finds nothing new to analyze.
    await execute_batch(
        db=db,
        broadcaster=broadcaster,
        task_id=seed.TASK_LEADERBOARD,
        analysis_engine=engine,
        action_executor=None,
    )
    assert engine.calls == 1  # not called again


async def test_event_batch_and_failure_retry(db):
    # First: a retriable failure keeps the batch pending with markers intact.
    failing = StubEngine(TimeoutError("LLM timeout"))
    broadcaster = RecordingBroadcaster()
    await execute_batch(
        db=db,
        broadcaster=broadcaster,
        task_id=seed.TASK_EVENT,
        analysis_engine=failing,
        action_executor=None,
    )
    assert "analysis_failed" in broadcaster.types()
    failed_payload = next(p for (t, p) in broadcaster.events if t == "analysis_failed")
    assert failed_payload["retrying"] is True

    log_row = await db.fetch_one(
        "SELECT level, category, kind, message, details FROM app_logs WHERE category = 'analysis' ORDER BY time DESC LIMIT 1"
    )
    assert log_row is not None
    assert log_row["level"] == "warning"
    assert log_row["kind"] == "batch.failure"
    assert "will retry" in log_row["message"]
    assert seed.TASK_EVENT in log_row["details"]

    pending = await db.fetch_one(
        "SELECT * FROM analysis_batches WHERE task_id = ? AND status = 'pending'",
        (seed.TASK_EVENT,),
    )
    assert pending is not None
    assert pending["retry_count"] == 1

    # Then: the retry resumes the SAME batch and succeeds.
    succeeding = StubEngine(
        [
            {
                "title": "情報A",
                "content": "重要內容",
                "location": "台北",
                "source_message_id": "msg-2",
            }
        ]
    )
    broadcaster2 = RecordingBroadcaster()
    await execute_batch(
        db=db,
        broadcaster=broadcaster2,
        task_id=seed.TASK_EVENT,
        analysis_engine=succeeding,
        action_executor=None,
    )
    assert "analysis_completed" in broadcaster2.types()

    batch = await db.fetch_one("SELECT * FROM analysis_batches WHERE id = ?", (pending["id"],))
    assert batch["status"] == "completed"
    assert batch["prompt_tokens"] == 42

    items = await db.fetch_all(
        "SELECT * FROM analysis_events WHERE task_id = ? AND batch_id = ?",
        (seed.TASK_EVENT, pending["id"]),
    )
    assert len(items) == 1
    assert items[0]["title"] == "情報A"
    assert items[0]["source_message_id"] == "msg-2"


async def test_action_triggered_on_completion(db):
    """Leaderboard completion above score_threshold fires the seeded action."""

    class RecordingExecutor:
        def __init__(self) -> None:
            self.completions: list[dict] = []

        async def trigger_for_completion(self, **kwargs) -> None:
            self.completions.append(kwargs)

    engine = StubEngine([{"topic": "hot", "rank": 1, "score": 0.9}])
    executor = RecordingExecutor()
    await execute_batch(
        db=db,
        broadcaster=RecordingBroadcaster(),
        task_id=seed.TASK_LEADERBOARD,
        analysis_engine=engine,
        action_executor=executor,
    )
    assert len(executor.completions) == 1
    call = executor.completions[0]
    assert call["task_id"] == seed.TASK_LEADERBOARD
    assert call["max_score"] == 0.9


async def test_paused_analysis_skips_batches(db):
    await set_configs(db, {"analysis_paused": "true"})
    engine = StubEngine([{"topic": "x", "score": 1.0}])
    await execute_batch(
        db=db,
        broadcaster=RecordingBroadcaster(),
        task_id=seed.TASK_LEADERBOARD,
        analysis_engine=engine,
        action_executor=None,
    )
    assert engine.calls == 0


async def test_trigger_threshold_blocks_batch_when_insufficient_messages(db):
    """Threshold and batch limit are independent: high threshold must not fire early."""
    await set_configs(
        db,
        {"analysis_trigger_threshold": "50", "analysis_batch_message_limit": "50"},
    )
    engine = StubEngine([{"topic": "x", "score": 1.0}])
    await execute_batch(
        db=db,
        broadcaster=RecordingBroadcaster(),
        task_id=seed.TASK_LEADERBOARD,
        analysis_engine=engine,
        action_executor=None,
    )
    assert engine.calls == 0
    pending = await db.fetch_one(
        "SELECT id FROM analysis_batches WHERE task_id = ? AND status = 'pending'",
        (seed.TASK_LEADERBOARD,),
    )
    assert pending is None


async def test_batch_already_claimed_is_not_processed_again(db):
    """The 'processing' write is a compare-and-set on 'pending'.

    Without the guard two overlapping dispatches for the same task both ran the
    LLM call and stored results for the same batch.
    """
    task = await load_task(db, seed.TASK_LEADERBOARD)
    assert task is not None
    messages = await fetch_unanalyzed_messages(db, task)
    batch_id = await create_batch_with_markers(db, task, messages)
    # Stand in for another dispatcher having already claimed the batch.
    await db.execute(
        "UPDATE analysis_batches SET status = 'processing' WHERE id = ?",
        (batch_id,),
    )

    engine = StubEngine([{"topic": "double-claim", "score": 0.9}])
    broadcaster = RecordingBroadcaster()
    await _process_batch(
        db=db,
        broadcaster=broadcaster,
        task=task,
        batch_id=batch_id,
        analysis_engine=engine,
        action_executor=None,
    )

    assert engine.calls == 0
    assert broadcaster.types() == []


async def test_batch_limit_caps_messages_per_batch(db):
    """Low threshold + high backlog: one batch should not exceed batch limit."""
    now = "2026-07-01T12:30:00+00:00"
    for idx, message_id in enumerate(("msg-4", "msg-5", "msg-6"), start=4):
        await db.execute(
            "INSERT INTO messages (id, account_id, platform, platform_id, "
            "platform_message_id, sender_id, sender_name, content, timestamp, "
            "raw_data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)",
            (
                message_id,
                seed.TG_ACCOUNT,
                *seed.TG_CHANNEL,
                f"10{idx}",
                f"sender-{idx}",
                f"User{idx}",
                f"extra message {idx}",
                f"2026-07-01T10:{idx:02d}:00+00:00",
                now,
            ),
        )

    await set_configs(
        db,
        {"analysis_trigger_threshold": "1", "analysis_batch_message_limit": "2"},
    )
    engine = StubEngine([{"topic": "batch-cap", "score": 0.8}])
    await execute_batch(
        db=db,
        broadcaster=RecordingBroadcaster(),
        task_id=seed.TASK_LEADERBOARD,
        analysis_engine=engine,
        action_executor=None,
    )
    assert engine.calls == 1
    batch = await db.fetch_one(
        "SELECT message_count FROM analysis_batches WHERE task_id = ? ORDER BY created_at DESC LIMIT 1",
        (seed.TASK_LEADERBOARD,),
    )
    assert batch is not None
    assert batch["message_count"] == 2

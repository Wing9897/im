"""Batch helper unit tests (stats + failure classification + unanalyzed bulk)."""

from __future__ import annotations

from server.analyzer.incremental import count_unanalyzed_messages, count_unanalyzed_messages_by_task
from server.queries.batch_stats import sum_queued_message_count
from server.scheduler.batch_failure import decide_batch_error_outcome


def test_sum_queued_message_count():
    rows = [
        {"status": "pending", "message_count": 3},
        {"status": "processing", "message_count": 2},
        {"status": "completed", "message_count": 99},
    ]
    assert sum_queued_message_count(rows) == 5


def test_decide_batch_error_outcome_retries_until_max():
    outcome = decide_batch_error_outcome("any error", current_retry=1, max_retries=3)
    assert outcome.retries_exhausted is False
    assert outcome.next_retry == 2


def test_decide_batch_error_outcome_resets_counter_when_exhausted():
    outcome = decide_batch_error_outcome("status 429", current_retry=2, max_retries=3)
    assert outcome.retries_exhausted is True
    assert outcome.next_retry == 0


def test_all_errors_use_same_retry_policy():
    outcome = decide_batch_error_outcome("authentication failed", current_retry=0, max_retries=3)
    assert outcome.retries_exhausted is False
    assert outcome.next_retry == 1


async def test_bulk_unanalyzed_matches_per_task(app):
    db = app.state.db
    tasks = await db.fetch_all("SELECT * FROM analysis_tasks ORDER BY id")
    bulk = await count_unanalyzed_messages_by_task(db, tasks)
    for task in tasks:
        task_id = str(task["id"])
        expected = await count_unanalyzed_messages(db, task)
        assert bulk.get(task_id, 0) == expected, task_id

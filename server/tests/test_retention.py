"""Retention TTL cleanup: messages, analysis, logs, batches."""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest

from server.config import set_configs
from server.db.database import Database
from server.scheduler.retention import cleanup_expired_data
from server.tests.db_helpers import insert_direct_analysis_task
from server.tests.retention_helpers import insert_message, seed_channel, seed_task_and_batch
from server.util import new_id, utc_now_iso


@pytest.fixture
async def db(tmp_path) -> AsyncIterator[Database]:
    database = Database(str(tmp_path / "retention-test.db"))
    await database.connect()
    await database.ensure_schema()
    yield database
    await database.close()


async def test_cleanup_disabled_when_all_retention_days_zero(db: Database) -> None:
    """Zero days disables the days-based categories only.

    Device-auth cleanup is expiry-driven and stays on; see
    ``test_expired_device_auth_rows_are_cleaned_with_all_retention_days_zero``.
    """
    await set_configs(
        db,
        {
            "retention_messages_days": "0",
            "retention_analysis_days": "0",
            "retention_leaderboard_days": "0",
            "retention_app_logs_days": "0",
            "retention_user_events_days": "0",
        },
    )
    await seed_channel(db)
    await insert_message(db, "old-msg", timestamp="2020-01-01T00:00:00+00:00")

    counts = await cleanup_expired_data(db)

    assert counts["messages"] == 0
    assert counts["analysis"] == 0
    assert counts["leaderboard"] == 0
    assert counts["action_trigger_history"] == 0
    assert counts["app_logs"] == 0
    assert counts["user_events"] == 0
    assert counts["timeline_dismissals"] == 0
    assert counts["timeline_importance"] == 0
    assert await db.fetch_value("SELECT COUNT(*) FROM messages") == 1


async def test_cleanup_messages_preserves_analysis_results(db: Database) -> None:
    await set_configs(
        db,
        {
            "retention_messages_days": "1",
            "retention_analysis_days": "0",
            "retention_leaderboard_days": "0",
            "retention_app_logs_days": "0",
            "retention_user_events_days": "0",
        },
    )
    await seed_channel(db)
    await seed_task_and_batch(db)

    old_ts = "2020-01-01T00:00:00+00:00"
    recent_ts = utc_now_iso()
    await insert_message(db, "old-msg", timestamp=old_ts)
    await insert_message(db, "new-msg", timestamp=recent_ts)

    now = utc_now_iso()
    await db.execute(
        "INSERT INTO analysis_markers (id, message_id, task_id, version, batch_id, analyzed_at) "
        "VALUES (?, ?, ?, 1, ?, ?)",
        (new_id(), "old-msg", "task-1", "batch-1", now),
    )
    event_id = new_id()
    await db.execute(
        "INSERT INTO analysis_events (id, task_id, version, batch_id, title, body, content_hash, "
        "semantic_hash, location, source_message_id, created_at, updated_at) "
        "VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (event_id, "task-1", "batch-1", "Event", "summary", "hash-event-1", "sem-event-1", "N/A", "old-msg", now, now),
    )
    topic_id = new_id()
    await db.execute(
        "INSERT INTO trending_topics (id, task_id, version, batch_id, rank, topic_name, score, "
        "summary, created_at, updated_at) VALUES (?, ?, 1, ?, 1, ?, 1.0, ?, ?, ?)",
        (topic_id, "task-1", "batch-1", "topic-a", "summary", now, now),
    )
    await db.execute(
        "INSERT INTO topic_messages (topic_id, message_id) VALUES (?, ?)",
        (topic_id, "old-msg"),
    )

    counts = await cleanup_expired_data(db)

    assert counts["messages"] == 1
    assert await db.fetch_value("SELECT COUNT(*) FROM messages WHERE id = 'old-msg'") == 0
    assert await db.fetch_value("SELECT COUNT(*) FROM messages WHERE id = 'new-msg'") == 1
    assert await db.fetch_value("SELECT COUNT(*) FROM analysis_markers WHERE message_id = 'old-msg'") == 0
    assert await db.fetch_value("SELECT COUNT(*) FROM analysis_events WHERE id = ?", (event_id,)) == 1
    assert await db.fetch_value("SELECT source_message_id FROM analysis_events WHERE id = ?", (event_id,)) is None
    assert await db.fetch_value("SELECT COUNT(*) FROM topic_messages WHERE message_id = 'old-msg'") == 0
    assert await db.fetch_value("SELECT COUNT(*) FROM trending_topics WHERE id = ?", (topic_id,)) == 1


async def test_category_ttls_are_independent(db: Database) -> None:
    await set_configs(
        db,
        {
            "retention_messages_days": "0",
            "retention_analysis_days": "1",
            "retention_leaderboard_days": "1",
            "retention_app_logs_days": "0",
            "retention_user_events_days": "0",
        },
    )
    await seed_channel(db)
    await seed_task_and_batch(db)
    await insert_message(db, "msg-1", timestamp="2020-01-01T00:00:00+00:00")

    now = utc_now_iso()
    old = "2020-01-01T00:00:00+00:00"
    await db.execute(
        "INSERT INTO analysis_events (id, task_id, version, batch_id, title, body, content_hash, "
        "semantic_hash, location, start_time, source_message_id, created_at, updated_at) "
        "VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)",
        ("intel-old", "task-1", "batch-1", "Intel", "body", "h-intel", "s-intel", "N/A", "msg-1", old, old),
    )
    await db.execute(
        "INSERT INTO analysis_events (id, task_id, version, batch_id, title, body, content_hash, "
        "semantic_hash, location, start_time, source_message_id, created_at, updated_at) "
        "VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ("tl-old", "task-1", "batch-1", "TL", "body", "h-tl", "s-tl", "N/A", old, "msg-1", now, now),
    )
    await db.execute(
        "INSERT INTO trending_topics (id, task_id, version, batch_id, rank, topic_name, score, "
        "summary, created_at, updated_at) VALUES (?, ?, 1, ?, 1, ?, 1.0, ?, ?, ?)",
        ("topic-old", "task-1", "batch-1", "topic", "sum", old, old),
    )
    await db.execute(
        "INSERT INTO analysis_events (id, task_id, version, batch_id, title, body, content_hash, "
        "semantic_hash, location, start_time, created_at, updated_at) "
        "VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, NULL, ?, ?)",
        ("intel-new", "task-1", "batch-1", "IntelN", "body", "h-intel-n", "s-intel-n", "N/A", now, now),
    )
    await db.execute(
        "INSERT INTO analysis_events (id, task_id, version, batch_id, title, body, content_hash, "
        "semantic_hash, location, start_time, created_at, updated_at) "
        "VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ("tl-new", "task-1", "batch-1", "TLN", "body", "h-tl-n", "s-tl-n", "N/A", now, now, now),
    )
    await db.execute(
        "INSERT INTO trending_topics (id, task_id, version, batch_id, rank, topic_name, score, "
        "summary, created_at, updated_at) VALUES (?, ?, 1, ?, 2, ?, 1.0, ?, ?, ?)",
        ("topic-new", "task-1", "batch-1", "topic-n", "sum", now, now),
    )

    counts = await cleanup_expired_data(db)

    assert counts["messages"] == 0
    assert counts["analysis"] >= 1
    assert await db.fetch_value("SELECT COUNT(*) FROM messages") == 1
    assert await db.fetch_value("SELECT COUNT(*) FROM analysis_events WHERE id = 'intel-old'") == 0
    assert await db.fetch_value("SELECT COUNT(*) FROM analysis_events WHERE id = 'intel-new'") == 1
    assert await db.fetch_value("SELECT COUNT(*) FROM analysis_events WHERE id = 'tl-old'") == 0
    assert await db.fetch_value("SELECT COUNT(*) FROM analysis_events WHERE id = 'tl-new'") == 1
    assert await db.fetch_value("SELECT COUNT(*) FROM trending_topics WHERE id = 'topic-old'") == 0
    assert await db.fetch_value("SELECT COUNT(*) FROM trending_topics WHERE id = 'topic-new'") == 1


async def test_zero_disables_analysis_only(db: Database) -> None:
    await set_configs(
        db,
        {
            "retention_messages_days": "0",
            "retention_analysis_days": "0",
            "retention_leaderboard_days": "1",
            "retention_app_logs_days": "0",
            "retention_user_events_days": "0",
        },
    )
    await seed_task_and_batch(db)
    old = "2020-01-01T00:00:00+00:00"
    await db.execute(
        "INSERT INTO analysis_events (id, task_id, version, batch_id, title, body, content_hash, "
        "semantic_hash, location, start_time, created_at, updated_at) "
        "VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, NULL, ?, ?)",
        ("intel-old", "task-1", "batch-1", "I", "b", "h1", "s1", "N/A", old, old),
    )
    await db.execute(
        "INSERT INTO trending_topics (id, task_id, version, batch_id, rank, topic_name, score, "
        "summary, created_at, updated_at) VALUES (?, ?, 1, ?, 1, ?, 1.0, ?, ?, ?)",
        ("topic-old", "task-1", "batch-1", "topic", "sum", old, old),
    )

    await cleanup_expired_data(db)

    assert await db.fetch_value("SELECT COUNT(*) FROM analysis_events WHERE id = 'intel-old'") == 1
    assert await db.fetch_value("SELECT COUNT(*) FROM trending_topics WHERE id = 'topic-old'") == 0


async def test_cleanup_prunes_action_trigger_history_with_messages_ttl(db: Database) -> None:
    await set_configs(
        db,
        {
            "retention_messages_days": "1",
            "retention_analysis_days": "0",
            "retention_leaderboard_days": "0",
            "retention_app_logs_days": "0",
            "retention_user_events_days": "0",
        },
    )
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO actions (id, name, action_type, configuration, is_enabled, created_at, updated_at) "
        "VALUES (?, ?, 'http_webhook', '{}', 1, ?, ?)",
        ("act-1", "Webhook", now, now),
    )
    await db.execute(
        "INSERT INTO action_trigger_history (id, action_id, trigger_reason, status, triggered_at) "
        "VALUES (?, ?, 'manual', 'success', ?)",
        (new_id(), "act-1", "2020-01-01T00:00:00+00:00"),
    )
    await db.execute(
        "INSERT INTO action_trigger_history (id, action_id, trigger_reason, status, triggered_at) "
        "VALUES (?, ?, 'manual', 'success', ?)",
        (new_id(), "act-1", now),
    )

    counts = await cleanup_expired_data(db)

    assert counts["action_trigger_history"] == 1
    assert await db.fetch_value("SELECT COUNT(*) FROM action_trigger_history") == 1


async def test_cleanup_app_logs_and_user_events(db: Database) -> None:
    await set_configs(
        db,
        {
            "retention_messages_days": "0",
            "retention_analysis_days": "0",
            "retention_leaderboard_days": "0",
            "retention_app_logs_days": "1",
            "retention_user_events_days": "1",
        },
    )
    now = utc_now_iso()
    old = "2020-01-01T00:00:00+00:00"
    await db.execute(
        "INSERT INTO app_logs (id, time, level, category, kind, message, details) "
        "VALUES (?, ?, 'info', 'system', 'system', 'old', NULL)",
        ("log-old", old),
    )
    await db.execute(
        "INSERT INTO app_logs (id, time, level, category, kind, message, details) "
        "VALUES (?, ?, 'info', 'system', 'system', 'new', NULL)",
        ("log-new", now),
    )
    await db.execute(
        "INSERT INTO user_events (id, title, body, start_time, end_time, location, origin, created_at, updated_at) "
        "VALUES (?, ?, '', ?, NULL, '', 'manual', ?, ?)",
        ("ue-old", "Old", old, old, old),
    )
    await db.execute(
        "INSERT INTO user_events (id, title, body, start_time, end_time, location, origin, created_at, updated_at) "
        "VALUES (?, ?, '', ?, NULL, '', 'manual', ?, ?)",
        ("ue-new", "New", now, now, now),
    )

    counts = await cleanup_expired_data(db)

    assert counts["app_logs"] == 1
    assert counts["user_events"] == 1
    assert await db.fetch_value("SELECT COUNT(*) FROM app_logs WHERE id = 'log-old'") == 0
    assert await db.fetch_value("SELECT COUNT(*) FROM app_logs WHERE id = 'log-new'") == 1
    assert await db.fetch_value("SELECT COUNT(*) FROM user_events WHERE id = 'ue-old'") == 0
    assert await db.fetch_value("SELECT COUNT(*) FROM user_events WHERE id = 'ue-new'") == 1
    summary = await db.fetch_one("SELECT * FROM app_logs WHERE kind = 'retention.cleanup' LIMIT 1")
    assert summary is not None
    assert "Retention cleanup" in summary["message"]


async def test_cleanup_completed_batches_with_analysis_ttl(db: Database) -> None:
    await set_configs(
        db,
        {
            "retention_messages_days": "0",
            "retention_analysis_days": "1",
            "retention_leaderboard_days": "0",
            "retention_app_logs_days": "0",
            "retention_user_events_days": "0",
        },
    )
    now = utc_now_iso()
    old = "2020-01-01T00:00:00+00:00"
    await insert_direct_analysis_task(
        db,
        "task-batch",
        analysis_mode="intel_event",
        name="Task",
        prompt_template="prompt",
        schedule_rrule="FREQ=SECONDLY;INTERVAL=10",
    )
    await db.execute(
        "INSERT INTO analysis_batches (id, task_id, version, status, message_count, retry_count, "
        "created_at, updated_at, completed_at) VALUES (?, ?, 1, 'completed', 1, 0, ?, ?, ?)",
        ("batch-old", "task-batch", old, old, old),
    )
    await db.execute(
        "INSERT INTO analysis_batches (id, task_id, version, status, message_count, retry_count, "
        "created_at, updated_at, completed_at) VALUES (?, ?, 1, 'completed', 1, 0, ?, ?, ?)",
        ("batch-new", "task-batch", now, now, now),
    )

    counts = await cleanup_expired_data(db)

    assert counts["analysis"] >= 1
    assert await db.fetch_value("SELECT COUNT(*) FROM analysis_batches WHERE id = 'batch-old'") == 0
    assert await db.fetch_value("SELECT COUNT(*) FROM analysis_batches WHERE id = 'batch-new'") == 1

"""Unit tests for server/scheduler/retention.py."""

from __future__ import annotations

from typing import AsyncIterator

import pytest

from server.config import set_configs
from server.db.database import Database
from server.scheduler.retention import cleanup_expired_data
from server.util import new_id, utc_now_iso


@pytest.fixture
async def db(tmp_path) -> AsyncIterator[Database]:
    database = Database(str(tmp_path / "retention-test.db"))
    await database.connect()
    await database.ensure_schema()
    yield database
    await database.close()


async def _seed_channel(db: Database, platform: str = "rss", platform_id: str = "feed-1") -> None:
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO channels (platform, platform_id, channel_name, created_at) VALUES (?, ?, ?, ?)",
        (platform, platform_id, "Test Feed", now),
    )


async def _insert_message(
    db: Database,
    message_id: str,
    *,
    timestamp: str,
    platform: str = "rss",
    platform_id: str = "feed-1",
) -> None:
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO messages (id, platform, platform_id, content, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (message_id, platform, platform_id, "hello", timestamp, now),
    )


async def _seed_task_and_batch(db: Database) -> None:
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO analysis_tasks (id, name, prompt_template, analysis_mode, analysis_time_range, "
        "version, is_active, schedule_rrule, created_at, updated_at) "
        "VALUES (?, ?, ?, 'intel_event', 'all', 1, 1, 'FREQ=SECONDLY;INTERVAL=10', ?, ?)",
        ("task-1", "Task", "prompt", now, now),
    )
    await db.execute(
        "INSERT INTO analysis_batches (id, task_id, version, status, message_count, retry_count, "
        "created_at, updated_at) VALUES (?, ?, 1, 'completed', 1, 0, ?, ?)",
        ("batch-1", "task-1", now, now),
    )


async def _insert_device_session(
    db: Database,
    session_id: str,
    *,
    expires_at: str,
    revoked_at: str | None = None,
) -> None:
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO device_sessions (id, label, refresh_token_hash, created_at, last_seen_at, "
        "expires_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (session_id, "Device", f"refresh-{session_id}", now, now, expires_at, revoked_at),
    )


async def _insert_access_token(db: Database, token_id: str, session_id: str, *, expires_at: str) -> None:
    await db.execute(
        "INSERT INTO device_access_tokens (id, session_id, token_hash, created_at, expires_at, revoked_at) "
        "VALUES (?, ?, ?, ?, ?, NULL)",
        (token_id, session_id, f"access-{token_id}", utc_now_iso(), expires_at),
    )


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
    await _seed_channel(db)
    await _insert_message(db, "old-msg", timestamp="2020-01-01T00:00:00+00:00")

    counts = await cleanup_expired_data(db)

    assert counts["messages"] == 0
    assert counts["analysis"] == 0
    assert counts["leaderboard"] == 0
    assert counts["action_trigger_history"] == 0
    assert counts["app_logs"] == 0
    assert counts["user_events"] == 0
    assert counts["timeline_dismissals"] == 0
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
    await _seed_channel(db)
    await _seed_task_and_batch(db)

    old_ts = "2020-01-01T00:00:00+00:00"
    recent_ts = utc_now_iso()
    await _insert_message(db, "old-msg", timestamp=old_ts)
    await _insert_message(db, "new-msg", timestamp=recent_ts)

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
    await _seed_channel(db)
    await _seed_task_and_batch(db)
    await _insert_message(db, "msg-1", timestamp="2020-01-01T00:00:00+00:00")

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
    await _seed_task_and_batch(db)
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


async def test_expired_device_auth_rows_are_cleaned_with_all_retention_days_zero(db: Database) -> None:
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
    old = "2020-01-01T00:00:00+00:00"
    future = "2999-01-01T00:00:00+00:00"
    await _insert_device_session(db, "sess-live", expires_at=future)
    await _insert_device_session(db, "sess-old", expires_at=old)
    await _insert_access_token(db, "tok-live", "sess-live", expires_at=future)
    await _insert_access_token(db, "tok-old", "sess-live", expires_at=old)

    counts = await cleanup_expired_data(db)

    assert counts["device_access_tokens"] == 1
    assert counts["device_sessions"] == 1
    assert await db.fetch_value("SELECT COUNT(*) FROM device_sessions WHERE id = 'sess-old'") == 0
    assert await db.fetch_value("SELECT COUNT(*) FROM device_sessions WHERE id = 'sess-live'") == 1
    assert await db.fetch_value("SELECT COUNT(*) FROM device_access_tokens WHERE id = 'tok-old'") == 0
    assert await db.fetch_value("SELECT COUNT(*) FROM device_access_tokens WHERE id = 'tok-live'") == 1


async def test_expired_device_session_takes_its_access_tokens_with_it(db: Database) -> None:
    """A session past its refresh window drops unexpired tokens through FK CASCADE."""
    old = "2020-01-01T00:00:00+00:00"
    await _insert_device_session(db, "sess-old", expires_at=old)
    await _insert_access_token(db, "tok-unexpired", "sess-old", expires_at="2999-01-01T00:00:00+00:00")

    counts = await cleanup_expired_data(db)

    assert counts["device_sessions"] == 1
    # Cascade-removed rows are not attributed to the token category.
    assert counts["device_access_tokens"] == 0
    assert await db.fetch_value("SELECT COUNT(*) FROM device_access_tokens") == 0


async def test_revoked_but_unexpired_device_session_survives_cleanup(db: Database) -> None:
    """Revocation state is not a retention trigger; the refresh window is."""
    await _insert_device_session(
        db,
        "sess-revoked",
        expires_at="2999-01-01T00:00:00+00:00",
        revoked_at=utc_now_iso(),
    )

    counts = await cleanup_expired_data(db)

    assert counts["device_sessions"] == 0
    assert await db.fetch_value("SELECT COUNT(*) FROM device_sessions WHERE id = 'sess-revoked'") == 1


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
    await db.execute(
        "INSERT INTO analysis_tasks (id, name, prompt_template, analysis_mode, analysis_time_range, "
        "version, is_active, schedule_rrule, created_at, updated_at) "
        "VALUES (?, ?, ?, 'intel_event', 'all', 1, 1, 'FREQ=SECONDLY;INTERVAL=10', ?, ?)",
        ("task-batch", "Task", "prompt", now, now),
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


async def test_cleanup_orphan_timeline_dismissals(db: Database) -> None:
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
    now = utc_now_iso()
    await _seed_task_and_batch(db)
    await db.execute(
        "INSERT INTO analysis_events (id, task_id, version, batch_id, title, body, content_hash, "
        "semantic_hash, location, created_at, updated_at) "
        "VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)",
        ("ev-live", "task-1", "batch-1", "Live", "b", "h-live", "s-live", "N/A", now, now),
    )
    await db.execute(
        "INSERT INTO user_events (id, title, body, start_time, end_time, location, origin, created_at, updated_at) "
        "VALUES (?, ?, '', ?, NULL, '', 'manual', ?, ?)",
        ("ue-live", "Live", now, now, now),
    )
    await db.execute(
        "INSERT INTO items (id, title, notes, status, created_at, updated_at) VALUES (?, ?, '', 'active', ?, ?)",
        ("item-live", "Live item", now, now),
    )
    await db.execute(
        "INSERT INTO timeline_dismissals (source, event_id, dismissed_at) VALUES (?, ?, ?)",
        ("analysis", "ev-live", now),
    )
    await db.execute(
        "INSERT INTO timeline_dismissals (source, event_id, dismissed_at) VALUES (?, ?, ?)",
        ("analysis", "ev-gone", now),
    )
    await db.execute(
        "INSERT INTO timeline_dismissals (source, event_id, dismissed_at) VALUES (?, ?, ?)",
        ("user", "ue-live", now),
    )
    await db.execute(
        "INSERT INTO timeline_dismissals (source, event_id, dismissed_at) VALUES (?, ?, ?)",
        ("user", "ue-gone", now),
    )
    await db.execute(
        "INSERT INTO timeline_dismissals (source, event_id, dismissed_at) VALUES (?, ?, ?)",
        ("item_remind", "item:item-live:remind", now),
    )
    await db.execute(
        "INSERT INTO timeline_dismissals (source, event_id, dismissed_at) VALUES (?, ?, ?)",
        ("item_remind", "item:item-gone:remind", now),
    )
    await db.execute(
        "INSERT INTO recurring_schedules "
        "(id, name, workset_id, is_active, rrule, dtstart, timezone, created_at, updated_at) "
        "VALUES (?, ?, '__user__', 1, 'FREQ=DAILY', ?, 'floating', ?, ?)",
        ("task-cal-live", "Cal Live", "2026-07-23T10:00:00", now, now),
    )
    await db.execute(
        "INSERT INTO timeline_dismissals (source, event_id, dismissed_at) VALUES (?, ?, ?)",
        ("recurring", "task-cal-live:20260723T100000Z", now),
    )
    await db.execute(
        "INSERT INTO timeline_dismissals (source, event_id, dismissed_at) VALUES (?, ?, ?)",
        ("recurring", "task-cal-gone:20260724T100000Z", now),
    )

    counts = await cleanup_expired_data(db)

    assert counts["timeline_dismissals"] == 4
    assert await db.fetch_value("SELECT COUNT(*) FROM timeline_dismissals WHERE event_id = 'ev-live'") == 1
    assert await db.fetch_value("SELECT COUNT(*) FROM timeline_dismissals WHERE event_id = 'ue-live'") == 1
    assert await db.fetch_value("SELECT COUNT(*) FROM timeline_dismissals WHERE event_id = 'item:item-live:remind'") == 1
    assert (
        await db.fetch_value(
            "SELECT COUNT(*) FROM timeline_dismissals WHERE event_id = 'task-cal-live:20260723T100000Z'"
        )
        == 1
    )
    assert (
        await db.fetch_value(
            "SELECT COUNT(*) FROM timeline_dismissals WHERE event_id IN ("
            "'ev-gone', 'ue-gone', 'item:item-gone:remind', 'task-cal-gone:20260724T100000Z')"
        )
        == 0
    )

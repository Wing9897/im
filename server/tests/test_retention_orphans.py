"""Retention orphan cleanup: device auth rows and timeline markers."""

from __future__ import annotations

from collections.abc import AsyncIterator

import pytest

from server.config import set_configs
from server.db.database import Database
from server.scheduler.retention import cleanup_expired_data
from server.tests.retention_helpers import (
    insert_access_token,
    insert_device_session,
    seed_task_and_batch,
)
from server.util import utc_now_iso


@pytest.fixture
async def db(tmp_path) -> AsyncIterator[Database]:
    database = Database(str(tmp_path / "retention-test.db"))
    await database.connect()
    await database.ensure_schema()
    yield database
    await database.close()


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
    await insert_device_session(db, "sess-live", expires_at=future)
    await insert_device_session(db, "sess-old", expires_at=old)
    await insert_access_token(db, "tok-live", "sess-live", expires_at=future)
    await insert_access_token(db, "tok-old", "sess-live", expires_at=old)

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
    await insert_device_session(db, "sess-old", expires_at=old)
    await insert_access_token(db, "tok-unexpired", "sess-old", expires_at="2999-01-01T00:00:00+00:00")

    counts = await cleanup_expired_data(db)

    assert counts["device_sessions"] == 1
    # Cascade-removed rows are not attributed to the token category.
    assert counts["device_access_tokens"] == 0
    assert await db.fetch_value("SELECT COUNT(*) FROM device_access_tokens") == 0


async def test_revoked_but_unexpired_device_session_survives_cleanup(db: Database) -> None:
    """Revocation state is not a retention trigger; the refresh window is."""
    await insert_device_session(
        db,
        "sess-revoked",
        expires_at="2999-01-01T00:00:00+00:00",
        revoked_at=utc_now_iso(),
    )

    counts = await cleanup_expired_data(db)

    assert counts["device_sessions"] == 0
    assert await db.fetch_value("SELECT COUNT(*) FROM device_sessions WHERE id = 'sess-revoked'") == 1


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
    await seed_task_and_batch(db)
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
        "VALUES (?, ?, '__general__', 1, 'FREQ=DAILY', ?, 'floating', ?, ?)",
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
    assert (
        await db.fetch_value("SELECT COUNT(*) FROM timeline_dismissals WHERE event_id = 'item:item-live:remind'") == 1
    )
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


async def test_cleanup_orphan_timeline_importance(db: Database) -> None:
    """Importance markers mirror the dismissals orphan rules (same source vocabulary)."""
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
    await seed_task_and_batch(db)
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
        "INSERT INTO recurring_schedules "
        "(id, name, workset_id, is_active, rrule, dtstart, timezone, created_at, updated_at) "
        "VALUES (?, ?, '__general__', 1, 'FREQ=DAILY', ?, 'floating', ?, ?)",
        ("task-cal-live", "Cal Live", "2026-07-23T10:00:00", now, now),
    )
    marks = [
        ("analysis", "ev-live"),
        ("analysis", "ev-gone"),
        ("user", "ue-live"),
        ("user", "ue-gone"),
        ("item_remind", "item:item-live:remind"),
        ("item_remind", "item:item-gone:remind"),
        ("recurring", "task-cal-live:20260723T100000Z"),
        ("recurring", "task-cal-gone:20260724T100000Z"),
    ]
    for source, event_id in marks:
        await db.execute(
            "INSERT INTO timeline_importance (source, event_id, marked_at) VALUES (?, ?, ?)",
            (source, event_id, now),
        )

    counts = await cleanup_expired_data(db)

    assert counts["timeline_importance"] == 4
    assert await db.fetch_value("SELECT COUNT(*) FROM timeline_importance WHERE event_id = 'ev-live'") == 1
    assert await db.fetch_value("SELECT COUNT(*) FROM timeline_importance WHERE event_id = 'ue-live'") == 1
    assert (
        await db.fetch_value("SELECT COUNT(*) FROM timeline_importance WHERE event_id = 'item:item-live:remind'") == 1
    )
    assert (
        await db.fetch_value(
            "SELECT COUNT(*) FROM timeline_importance WHERE event_id = 'task-cal-live:20260723T100000Z'"
        )
        == 1
    )
    assert (
        await db.fetch_value(
            "SELECT COUNT(*) FROM timeline_importance WHERE event_id IN ("
            "'ev-gone', 'ue-gone', 'item:item-gone:remind', 'task-cal-gone:20260724T100000Z')"
        )
        == 0
    )

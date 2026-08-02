"""project_message_cursors table replaces system_config project cursors."""

from __future__ import annotations

from server.db.database import TransactionDb
from server.queries.project_tick_queries import (
    ProjectMessageCursor,
    fetch_project_messages_since,
    load_project_message_cursor,
    store_project_message_cursor,
)
from server.queries.tasks_queries import insert_analysis_task
from server.util import new_id, utc_now_iso


async def _insert_project(db, task_id: str) -> None:
    now = utc_now_iso()
    async with db.transaction() as conn:
        await insert_analysis_task(
            TransactionDb(conn),
            task_id=task_id,
            name="Cursor Project",
            description=None,
            prompt_template="x",
            analysis_mode="project",
            analysis_time_range="all",
            schedule_rrule="FREQ=HOURLY",
            rrule=None,
            event_start_time=None,
            event_end_time=None,
            event_is_all_day=0,
            event_location=None,
            event_description=None,
            now=now,
        )


async def test_project_message_cursor_roundtrip(app) -> None:
    db = app.state.db
    task_id = new_id()
    await _insert_project(db, task_id)

    assert await load_project_message_cursor(db, task_id) is None
    await store_project_message_cursor(db, task_id, "2026-07-27T12:00:00Z")
    loaded = await load_project_message_cursor(db, task_id)
    assert loaded == ProjectMessageCursor(timestamp="2026-07-27T12:00:00Z", message_id=None)

    await store_project_message_cursor(
        db,
        task_id,
        "2026-07-27T13:00:00Z",
        message_id="msg-b",
    )
    loaded = await load_project_message_cursor(db, task_id)
    assert loaded == ProjectMessageCursor(timestamp="2026-07-27T13:00:00Z", message_id="msg-b")

    legacy = await db.fetch_one(
        "SELECT value FROM system_config WHERE key = ?",
        (f"project_last_message_at:{task_id}",),
    )
    assert legacy is None


async def test_project_cursor_same_timestamp_does_not_skip_later_ids(app) -> None:
    db = app.state.db
    task_id = new_id()
    await _insert_project(db, task_id)
    now = utc_now_iso()
    platform = "rss"
    platform_id = f"feed-{task_id[:8]}"
    await db.execute(
        "INSERT OR IGNORE INTO channels (platform, platform_id, channel_name, created_at) VALUES (?, ?, ?, ?)",
        (platform, platform_id, "same-ts", now),
    )
    await db.execute(
        "INSERT OR IGNORE INTO task_channels (task_id, platform, platform_id) VALUES (?, ?, ?)",
        (task_id, platform, platform_id),
    )
    ts = "2026-07-28T10:00:00Z"
    await db.execute(
        "INSERT INTO messages (id, platform, platform_id, content, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        ("msg-a", platform, platform_id, "first", ts, now),
    )
    await db.execute(
        "INSERT INTO messages (id, platform, platform_id, content, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        ("msg-b", platform, platform_id, "second", ts, now),
    )
    await db.execute(
        "INSERT INTO messages (id, platform, platform_id, content, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        ("msg-c", platform, platform_id, "third", ts, now),
    )

    await store_project_message_cursor(db, task_id, ts, message_id="msg-a")
    rows = await fetch_project_messages_since(
        db,
        task_id=task_id,
        since=await load_project_message_cursor(db, task_id),
        limit=10,
    )
    ids = [str(row["id"]) for row in rows]
    assert ids == ["msg-b", "msg-c"]

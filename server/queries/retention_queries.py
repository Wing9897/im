"""Bounded SQL operations used by the retention scheduler."""

from __future__ import annotations

from server.db.database import Database

BATCH_SIZE = 1000
_DELETE_BY_ID_TABLES = frozenset(
    {
        "action_trigger_history",
        "analysis_batches",
        "analysis_events",
        "app_logs",
        "device_access_tokens",
        "device_sessions",
        "trending_topics",
        "user_events",
    }
)


async def _delete_ids(db: Database, table: str, ids: list[str]) -> int:
    if not ids:
        return 0
    if table not in _DELETE_BY_ID_TABLES:
        raise ValueError(f"Unsupported retention table: {table}")
    placeholders = ",".join("?" for _ in ids)
    async with db.transaction() as conn:
        await conn.execute(f"DELETE FROM {table} WHERE id IN ({placeholders})", ids)
    return len(ids)


async def cleanup_messages_batch(db: Database, cutoff_modifier: str) -> int:
    rows = await db.fetch_all(
        "SELECT id FROM messages WHERE datetime(timestamp) < datetime('now', ?) ORDER BY timestamp ASC LIMIT ?",
        (cutoff_modifier, BATCH_SIZE),
    )
    if not rows:
        return 0
    ids = [str(row["id"]) for row in rows]
    placeholders = ",".join("?" for _ in ids)
    async with db.transaction() as conn:
        await conn.execute(f"DELETE FROM analysis_markers WHERE message_id IN ({placeholders})", ids)
        await conn.execute(f"DELETE FROM messages WHERE id IN ({placeholders})", ids)
    return len(ids)


async def cleanup_action_trigger_history_batch(db: Database, cutoff_modifier: str) -> int:
    rows = await db.fetch_all(
        "SELECT id FROM action_trigger_history "
        "WHERE datetime(triggered_at) < datetime('now', ?) "
        "ORDER BY triggered_at ASC LIMIT ?",
        (cutoff_modifier, BATCH_SIZE),
    )
    return await _delete_ids(db, "action_trigger_history", [str(row["id"]) for row in rows])


async def cleanup_analysis_batch(db: Database, cutoff_modifier: str) -> int:
    rows = await db.fetch_all(
        "SELECT id FROM analysis_events "
        "WHERE datetime(COALESCE(NULLIF(TRIM(start_time), ''), created_at)) "
        "    < datetime('now', ?) "
        "ORDER BY datetime(COALESCE(NULLIF(TRIM(start_time), ''), created_at)) ASC LIMIT ?",
        (cutoff_modifier, BATCH_SIZE),
    )
    return await _delete_ids(db, "analysis_events", [str(row["id"]) for row in rows])


async def cleanup_completed_batches_batch(db: Database, cutoff_modifier: str) -> int:
    rows = await db.fetch_all(
        "SELECT id FROM analysis_batches "
        "WHERE status = 'completed' "
        "AND datetime(COALESCE(NULLIF(TRIM(completed_at), ''), updated_at)) "
        "    < datetime('now', ?) "
        "ORDER BY COALESCE(NULLIF(TRIM(completed_at), ''), updated_at) ASC LIMIT ?",
        (cutoff_modifier, BATCH_SIZE),
    )
    return await _delete_ids(db, "analysis_batches", [str(row["id"]) for row in rows])


async def cleanup_leaderboard_batch(db: Database, cutoff_modifier: str) -> int:
    rows = await db.fetch_all(
        "SELECT id FROM trending_topics "
        "WHERE datetime(updated_at) < datetime('now', ?) "
        "ORDER BY updated_at ASC LIMIT ?",
        (cutoff_modifier, BATCH_SIZE),
    )
    return await _delete_ids(db, "trending_topics", [str(row["id"]) for row in rows])


async def cleanup_app_logs_batch(db: Database, cutoff_modifier: str) -> int:
    rows = await db.fetch_all(
        "SELECT id FROM app_logs WHERE datetime(time) < datetime('now', ?) ORDER BY time ASC LIMIT ?",
        (cutoff_modifier, BATCH_SIZE),
    )
    return await _delete_ids(db, "app_logs", [str(row["id"]) for row in rows])


async def cleanup_user_events_batch(db: Database, cutoff_modifier: str) -> int:
    rows = await db.fetch_all(
        "SELECT id FROM user_events "
        "WHERE datetime(COALESCE(NULLIF(TRIM(start_time), ''), created_at)) "
        "    < datetime('now', ?) "
        "ORDER BY datetime(COALESCE(NULLIF(TRIM(start_time), ''), created_at)) ASC LIMIT ?",
        (cutoff_modifier, BATCH_SIZE),
    )
    return await _delete_ids(db, "user_events", [str(row["id"]) for row in rows])


async def cleanup_orphan_timeline_dismissals_batch(db: Database) -> int:
    rows = await db.fetch_all(
        "SELECT source, event_id FROM timeline_dismissals "
        "WHERE (source = 'analysis' AND NOT EXISTS ("
        "        SELECT 1 FROM analysis_events e WHERE e.id = timeline_dismissals.event_id"
        "      ))"
        "   OR (source = 'user' AND NOT EXISTS ("
        "        SELECT 1 FROM user_events e WHERE e.id = timeline_dismissals.event_id"
        "      ))"
        "   OR (source = 'item_remind' AND NOT EXISTS ("
        "        SELECT 1 FROM items i WHERE i.id = CASE"
        "          WHEN timeline_dismissals.event_id LIKE 'item:%:remind'"
        "          THEN substr("
        "            timeline_dismissals.event_id,"
        "            6,"
        "            length(timeline_dismissals.event_id) - 12"
        "          )"
        "          ELSE NULL"
        "        END"
        "      ))"
        "   OR (source = 'recurring' AND instr(event_id, ':') > 0 AND NOT EXISTS ("
        "        SELECT 1 FROM recurring_schedules s"
        "        WHERE s.id = substr("
        "          timeline_dismissals.event_id, 1,"
        "          instr(timeline_dismissals.event_id, ':') - 1"
        "        )"
        "      )) "
        "LIMIT ?",
        (BATCH_SIZE,),
    )
    if not rows:
        return 0
    async with db.transaction() as conn:
        await conn.executemany(
            "DELETE FROM timeline_dismissals WHERE source = ? AND event_id = ?",
            [(str(row["source"]), str(row["event_id"])) for row in rows],
        )
    return len(rows)


async def cleanup_device_access_tokens_batch(db: Database) -> int:
    rows = await db.fetch_all(
        "SELECT id FROM device_access_tokens "
        "WHERE datetime(expires_at) < datetime('now') "
        "ORDER BY expires_at ASC LIMIT ?",
        (BATCH_SIZE,),
    )
    return await _delete_ids(db, "device_access_tokens", [str(row["id"]) for row in rows])


async def cleanup_device_sessions_batch(db: Database) -> int:
    rows = await db.fetch_all(
        "SELECT id FROM device_sessions WHERE datetime(expires_at) < datetime('now') ORDER BY expires_at ASC LIMIT ?",
        (BATCH_SIZE,),
    )
    return await _delete_ids(db, "device_sessions", [str(row["id"]) for row in rows])

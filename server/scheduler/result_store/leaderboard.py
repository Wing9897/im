from __future__ import annotations

from typing import Any

from server.analyzer.leaderboard import merge_leaderboard
from server.scheduler.result_store._common import clean_str, existing_message_ids
from server.util import new_id


async def store_trending_topics(
    conn: Any,
    task_id: str,
    version: int,
    batch_id: str,
    items: list[dict[str, Any]],
    now: str,
) -> int:
    """Merge LLM items onto the existing Top-10 board."""
    updates: list[dict[str, Any]] = []
    related_by_topic: dict[str, list[Any]] = {}
    for item in items:
        topic_name = clean_str(item.get("topic") or item.get("topic_name"))
        if not topic_name:
            continue
        try:
            score = float(item.get("score") or 0.0)
        except (TypeError, ValueError):
            score = 0.0
        summary = clean_str(item.get("summary")) or None
        updates.append({"topic": topic_name, "score": score, "summary": summary})
        related = item.get("related_message_ids")
        if isinstance(related, list):
            related_by_topic[topic_name] = related

    if not updates:
        return 0

    async with conn.execute(
        "SELECT id, rank, topic_name, summary, score, updated_at "
        "FROM trending_topics WHERE task_id = ? AND version = ?",
        (task_id, version),
    ) as cursor:
        existing_rows = [dict(row) for row in await cursor.fetchall()]

    existing = [
        {
            "rank": row.get("rank"),
            "topic": row.get("topic_name"),
            "score": row.get("score"),
            "summary": row.get("summary"),
            "updated_at": row.get("updated_at"),
        }
        for row in existing_rows
        if row.get("rank") is not None
    ]
    topic_ids = {str(row["topic_name"]): str(row["id"]) for row in existing_rows}

    valid_message_ids = await existing_message_ids(
        conn, {mid for related in related_by_topic.values() for mid in related if isinstance(mid, str)}
    )
    merged = merge_leaderboard(existing, updates)
    kept_names: set[str] = set()
    pending_topic_messages: dict[str, list[Any]] = {}

    for entry in merged:
        topic_name = clean_str(entry.get("topic"))
        if not topic_name:
            continue
        kept_names.add(topic_name)
        rank = entry.get("rank")
        try:
            score = float(entry.get("score") or 0.0)
        except (TypeError, ValueError):
            score = 0.0
        summary = clean_str(entry.get("summary")) or None

        if rank is not None:
            await conn.execute(
                "UPDATE trending_topics SET rank = NULL "
                "WHERE task_id = ? AND version = ? AND rank = ? AND topic_name != ?",
                (task_id, version, rank, topic_name),
            )

        topic_id = topic_ids.get(topic_name)
        if topic_id is not None:
            await conn.execute(
                "UPDATE trending_topics SET rank = ?, score = ?, "
                "summary = COALESCE(?, summary), batch_id = ?, updated_at = ? "
                "WHERE id = ?",
                (rank, score, summary, batch_id, now, topic_id),
            )
        else:
            topic_id = new_id()
            topic_ids[topic_name] = topic_id
            await conn.execute(
                "INSERT INTO trending_topics "
                "(id, task_id, version, batch_id, rank, topic_name, score, "
                "summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (topic_id, task_id, version, batch_id, rank, topic_name, score, summary, now, now),
            )

        if topic_name in related_by_topic:
            pending_topic_messages[topic_id] = related_by_topic[topic_name]

    if pending_topic_messages:
        topic_ids_to_clear = list(pending_topic_messages.keys())
        placeholders = ",".join("?" for _ in topic_ids_to_clear)
        await conn.execute(
            f"DELETE FROM topic_messages WHERE topic_id IN ({placeholders})",
            tuple(topic_ids_to_clear),
        )
        link_rows: list[tuple[str, Any]] = []
        link_rows.extend(
            (topic_id, message_id)
            for topic_id, message_ids in pending_topic_messages.items()
            for message_id in message_ids
            if message_id in valid_message_ids
        )
        if link_rows:
            await conn.executemany(
                "INSERT OR IGNORE INTO topic_messages (topic_id, message_id) VALUES (?, ?)",
                link_rows,
            )

    for row in existing_rows:
        name = str(row["topic_name"])
        if name not in kept_names:
            await conn.execute("DELETE FROM trending_topics WHERE id = ?", (str(row["id"]),))

    return len(updates)

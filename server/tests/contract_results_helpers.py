"""Shared helpers for results contract tests."""

from __future__ import annotations

from server.tests import seed


async def insert_event(
    db,
    *,
    event_id: str,
    title: str,
    body: str,
    content_hash: str,
    semantic_hash: str,
    location: str,
    source_message_id: str | None,
    channel_names: str | None,
    latitude: float | None,
    longitude: float | None,
    created_at: str,
    start_time: str | None = None,
    end_time: str | None = None,
    event_key: str | None = None,
    participants_json: str = "[]",
    task_id: str = seed.TASK_EVENT,
    batch_id: str = seed.BATCH_EVENT,
) -> None:
    await db.execute(
        "INSERT INTO analysis_events (id, task_id, version, batch_id, title, body, "
        "start_time, end_time, location, latitude, longitude, participants_json, "
        "source_message_id, batch_source_channel_names, content_hash, semantic_hash, "
        "event_key, created_at, updated_at) "
        "VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            event_id,
            task_id,
            batch_id,
            title,
            body,
            start_time,
            end_time,
            location,
            latitude,
            longitude,
            participants_json,
            source_message_id,
            channel_names,
            content_hash,
            semantic_hash,
            event_key,
            created_at,
            created_at,
        ),
    )


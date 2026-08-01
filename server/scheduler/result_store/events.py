"""Persist unified analysis_events rows (timed UPSERT + untimed INSERT OR IGNORE)."""

from __future__ import annotations

import hashlib
import json
import re
from typing import Any

from server.scheduler.result_store._common import clean_str, existing_message_ids
from server.util import new_id

_WHITESPACE_RE = re.compile(r"\s+")
_JUNK_TIMELINE_TITLE = re.compile(
    r"(join\s+channel|complete\s+verification|group\s+join|加入頻道|完成驗證|驗證流程|verification)",
    re.IGNORECASE,
)

_INSERT_UNTIMED_SQL = (
    "INSERT OR IGNORE INTO analysis_events "
    "(id, task_id, version, batch_id, title, body, start_time, end_time, "
    "location, latitude, longitude, participants_json, source_message_id, "
    "batch_source_channel_names, content_hash, semantic_hash, event_key, "
    "created_at, updated_at) "
    "VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)"
)

_UPSERT_TIMED_SQL = (
    "INSERT INTO analysis_events "
    "(id, task_id, version, batch_id, title, body, start_time, end_time, "
    "location, latitude, longitude, participants_json, source_message_id, "
    "batch_source_channel_names, content_hash, semantic_hash, event_key, "
    "created_at, updated_at) "
    "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?) "
    "ON CONFLICT(task_id, version, event_key) WHERE event_key IS NOT NULL DO UPDATE SET "
    "title = excluded.title, "
    "body = excluded.body, "
    "end_time = excluded.end_time, "
    "location = excluded.location, "
    "latitude = COALESCE(excluded.latitude, analysis_events.latitude), "
    "longitude = COALESCE(excluded.longitude, analysis_events.longitude), "
    "participants_json = excluded.participants_json, "
    "source_message_id = COALESCE(excluded.source_message_id, analysis_events.source_message_id), "
    "batch_source_channel_names = COALESCE("
    "excluded.batch_source_channel_names, analysis_events.batch_source_channel_names), "
    "batch_id = excluded.batch_id, "
    "content_hash = excluded.content_hash, "
    "updated_at = excluded.updated_at"
)


def content_hash_for(title: str, body: str) -> str:
    return hashlib.sha256(f"{title}\x00{body}".encode()).hexdigest()


def semantic_hash_for(title: str, body: str) -> str:
    normalized = _WHITESPACE_RE.sub(" ", f"{title} {body}".lower()).strip()
    return hashlib.sha256(normalized.encode()).hexdigest()


def event_key_for(title: str, start_time: str) -> str:
    normalized = _WHITESPACE_RE.sub(" ", title.lower()).strip()
    return hashlib.sha256(f"{normalized}\x00{start_time}".encode()).hexdigest()


def _item_body(item: dict[str, Any]) -> str:
    for key in ("body", "content", "summary"):
        value = clean_str(item.get(key))
        if value:
            return value
    return ""


def _participants_json(item: dict[str, Any]) -> str:
    participants = item.get("participants")
    if not isinstance(participants, list):
        participants = []
    return json.dumps([str(p) for p in participants], ensure_ascii=False)


def _coords(item: dict[str, Any]) -> tuple[float, float]:
    """Return lat/lng; missing or invalid coordinates become Null Island (0, 0)."""
    try:
        lat_raw = item.get("latitude")
        lng_raw = item.get("longitude")
        if lat_raw is None and lng_raw is None:
            return 0.0, 0.0
        latitude = float(lat_raw) if lat_raw is not None else 0.0
        longitude = float(lng_raw) if lng_raw is not None else 0.0
    except (TypeError, ValueError):
        return 0.0, 0.0
    return latitude, longitude


async def store_analysis_events(
    conn: Any,
    task_id: str,
    version: int,
    batch_id: str,
    items: list[dict[str, Any]],
    channel_names: list[str],
    now: str,
) -> int:
    channel_names_json = json.dumps(channel_names, ensure_ascii=False) if channel_names else None
    valid_message_ids = await existing_message_ids(conn, {str(item.get("source_message_id") or "") for item in items})
    untimed_rows: list[tuple[Any, ...]] = []
    timed_rows: list[tuple[Any, ...]] = []

    for item in items:
        title = clean_str(item.get("title"))
        body = _item_body(item)
        if not title and not body:
            continue
        if title and _JUNK_TIMELINE_TITLE.search(title):
            continue

        source_message_id: str | None = str(item.get("source_message_id") or "")
        if source_message_id not in valid_message_ids:
            source_message_id = None
        location = clean_str(item.get("location")) or "N/A"
        latitude, longitude = _coords(item)
        participants_json = _participants_json(item)
        start_time = clean_str(item.get("start_time")) or None
        end_time = clean_str(item.get("end_time")) or None

        if start_time:
            key = event_key_for(title, start_time)
            timed_rows.append(
                (
                    new_id(),
                    task_id,
                    version,
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
                    channel_names_json,
                    # content_hash must stay unique per timed event; reuse event_key.
                    key,
                    key,
                    now,
                    now,
                )
            )
        else:
            untimed_rows.append(
                (
                    new_id(),
                    task_id,
                    version,
                    batch_id,
                    title,
                    body,
                    location,
                    latitude,
                    longitude,
                    participants_json,
                    source_message_id,
                    channel_names_json,
                    content_hash_for(title, body),
                    semantic_hash_for(title, body),
                    now,
                    now,
                )
            )

    stored = 0
    if untimed_rows:
        await conn.executemany(_INSERT_UNTIMED_SQL, untimed_rows)
        stored += len(untimed_rows)
    if timed_rows:
        await conn.executemany(_UPSERT_TIMED_SQL, timed_rows)
        stored += len(timed_rows)
    return stored

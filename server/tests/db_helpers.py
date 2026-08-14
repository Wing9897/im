"""Minimal row insertion for collector / scheduler / contract unit tests."""

from __future__ import annotations

from typing import Any

from server.db.database import Database
from server.tests import seed
from server.util import utc_now_iso


async def insert_minimal_source(
    db: Database,
    source_id: str,
    platform: str,
    *,
    name: str | None = None,
    status: str = "connected",
    credentials: str | None = None,
) -> None:
    now = utc_now_iso()
    display_name = name or f"{platform} test"
    await db.execute(
        "INSERT INTO sources (id, platform, name, status, credentials, created_at, updated_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        (source_id, platform, display_name, status, credentials, now, now),
    )


async def insert_channel(
    db: Database,
    platform: str,
    platform_id: str,
    *,
    channel_name: str | None = None,
) -> None:
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO channels (platform, platform_id, channel_name, created_at) VALUES (?, ?, ?, ?)",
        (platform, platform_id, channel_name or f"{platform} {platform_id}", now),
    )


async def link_source_channel(
    db: Database,
    source_id: str,
    platform: str,
    platform_id: str,
) -> None:
    await db.execute(
        "INSERT INTO source_channels (source_id, platform, platform_id) VALUES (?, ?, ?)",
        (source_id, platform, platform_id),
    )


async def insert_source_with_channels(
    db: Database,
    source_id: str,
    platform: str,
    channel_ids: list[str],
    *,
    name: str | None = None,
    status: str = "connected",
    credentials: str | None = None,
) -> None:
    await insert_minimal_source(
        db,
        source_id,
        platform,
        name=name,
        status=status,
        credentials=credentials,
    )
    for cid in channel_ids:
        await insert_channel(db, platform, cid, channel_name=f"Channel {cid}")
        await link_source_channel(db, source_id, platform, cid)


async def insert_direct_analysis_task(
    db: Database,
    task_id: str,
    *,
    analysis_mode: str,
    name: str | None = None,
    prompt_template: str = "Analyze",
    schedule_type: str | None = None,
    schedule_value: str | None = None,
    schedule_rrule: str | None = None,
) -> None:
    """Persist an analysis task directly for scheduler / agent-scope tests."""
    from server.domain.schedule import preset_to_trigger_rrule
    from server.tests.seed import ensure_default_llm_profile

    now = utc_now_iso()
    if schedule_rrule is None and schedule_type is not None:
        try:
            schedule_rrule = preset_to_trigger_rrule(schedule_type, schedule_value)
        except Exception:
            # Preserve intentionally invalid schedules for negative registration tests.
            schedule_rrule = f"INVALID;type={schedule_type};value={schedule_value}"
    profile_id = await ensure_default_llm_profile(db)
    await db.execute(
        "INSERT INTO analysis_tasks (id, name, prompt_template, analysis_mode, "
        "analysis_time_range, version, is_active, schedule_rrule, llm_profile_id, "
        "created_at, updated_at) VALUES (?, ?, ?, ?, 'all', 1, 1, ?, ?, ?, ?)",
        (
            task_id,
            name or f"Direct task {task_id}",
            prompt_template,
            analysis_mode,
            schedule_rrule,
            profile_id,
            now,
            now,
        ),
    )


async def insert_analysis_event(
    db: Any,
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

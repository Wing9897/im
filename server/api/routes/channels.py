"""Channels routes: live list (ChannelWithSource[]) and latest-messages.

``GET /api/v1/channels`` is the list; retired ``GET /api/v1/channels/with-sources``
stays 404 (see ``test_dead_endpoints``).
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request

from server.api.channel_refs import parse_channel_key_csv
from server.api.deps import API_DEPS, get_db
from server.api.schemas.responses import (
    ChannelWithSourceResponse,
    MessageResponse,
)
from server.errors import VALIDATION_ERROR, http_error
from server.queries.channels_queries import (
    fetch_channel_rows,
    fetch_latest_message_rows,
    fetch_source_channel_rows,
    fetch_source_rows,
)
from server.wire.serializers import channel_key, serialize_channel, serialize_message, serialize_source

router = APIRouter(prefix="/api/v1/channels", tags=["channels"], dependencies=API_DEPS)

_MAX_LATEST_CHANNELS = 100


def _primary_source_name(source: dict | None) -> str | None:
    if not source:
        return None
    name = source.get("name")
    if name and str(name).strip():
        return str(name).strip()
    return None


@router.get("", response_model=list[ChannelWithSourceResponse])
async def list_channels(request: Request) -> list[dict]:
    """ChannelWithSource[] — sourceName populated server-side."""
    db = get_db(request)
    channels = await fetch_channel_rows(db)
    links = await fetch_source_channel_rows(db)
    by_channel: dict[str, list[str]] = {}
    for link in links:
        key = channel_key(str(link["platform"]), str(link["platform_id"]))
        by_channel.setdefault(key, []).append(str(link["source_id"]))

    source_rows = await fetch_source_rows(db)
    sources_by_id = {str(row["id"]): serialize_source(row) for row in source_rows}

    result = []
    for row in channels:
        serialized = serialize_channel(row)
        source_ids = by_channel.get(serialized["id"], [])
        first = sources_by_id.get(source_ids[0]) if source_ids else None
        serialized["sourceIds"] = source_ids
        serialized["sourceId"] = source_ids[0] if source_ids else None
        serialized["sourceName"] = _primary_source_name(first)
        result.append(serialized)
    return result


@router.get("/latest-messages", response_model=dict[str, list[MessageResponse]])
async def latest_messages_by_channels(
    request: Request,
    channels: str,
    limit: int = 5,
) -> dict[str, list[dict[str, Any]]]:
    """Return the newest *limit* messages per channel key (``platform:platformId``)."""
    if limit < 1 or limit > 20:
        raise http_error(422, "limit must be between 1 and 20", error_code=VALIDATION_ERROR)
    channel_keys = parse_channel_key_csv(channels, max_keys=_MAX_LATEST_CHANNELS)
    if not channel_keys:
        return {}

    db = get_db(request)
    result: dict[str, list[dict[str, Any]]] = {
        channel_key(platform, platform_id): [] for platform, platform_id in channel_keys
    }
    rows = await fetch_latest_message_rows(db, channel_keys, limit=limit)
    for row in rows:
        key = channel_key(str(row["platform"]), str(row["platform_id"]))
        result[key].append(serialize_message(row))
    return result

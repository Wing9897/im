"""Source, channel, and message wire serializers."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from server.util import parse_json_dict


def serialize_source(row: Mapping[str, Any]) -> dict[str, Any]:
    """Source — credentials are never exposed on the wire."""
    return {
        "id": row["id"],
        "platform": str(row["platform"]),
        "name": row.get("name") or "",
        "status": row.get("status") or "disconnected",
        "lastError": row.get("last_error"),
        "lastConnectedAt": row.get("last_connected_at"),
        "createdAt": row.get("created_at"),
        "updatedAt": row.get("updated_at"),
    }


def channel_key(platform: str, platform_id: str) -> str:
    """Synthetic frontend channel id: ``platform:platformId``."""
    return f"{platform}:{platform_id}"


def serialize_channel(row: Mapping[str, Any]) -> dict[str, Any]:
    platform = str(row["platform"])
    platform_id = str(row["platform_id"])
    return {
        "id": channel_key(platform, platform_id),
        "platform": platform,
        "platformId": platform_id,
        "channelName": row.get("channel_name") or "",
        "createdAt": row.get("created_at"),
    }


def _message_media_from_raw(raw_data: Any) -> dict[str, Any] | None:
    if not raw_data:
        return None
    parsed = parse_json_dict(raw_data) if isinstance(raw_data, str) else raw_data
    media = parsed.get("media")
    if not isinstance(media, dict) or not media.get("kind"):
        return None
    result: dict[str, Any] = {"kind": str(media["kind"])}
    if media.get("mime"):
        result["mime"] = str(media["mime"])
    return result


def serialize_message(row: Mapping[str, Any]) -> dict[str, Any]:
    """Message — expects an optional joined ``channel_name`` column."""
    return {
        "id": row["id"],
        "sourceId": row.get("source_id"),
        "platform": row["platform"],
        "platformId": row["platform_id"],
        "channelName": row.get("channel_name"),
        "platformMessageId": row.get("platform_message_id"),
        "senderId": row.get("sender_id"),
        "senderName": row.get("sender_name"),
        "content": row.get("content") or "",
        "timestamp": row.get("timestamp"),
        "rawData": row.get("raw_data"),
        "media": _message_media_from_raw(row.get("raw_data")),
        "createdAt": row.get("created_at"),
    }


def serialize_channel_ref(row: Mapping[str, Any]) -> dict[str, Any]:
    """ChannelRef inside AnalysisTask.channelIds."""
    platform = str(row["platform"])
    platform_id = str(row["platform_id"])
    return {
        "platform": platform,
        "platformId": platform_id,
        "id": channel_key(platform, platform_id),
    }

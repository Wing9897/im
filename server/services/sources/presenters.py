"""Discord / RSS / MQTT / HTTP / Email list payloads."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import Any

from server.collector.email_config import (
    clamp_poll_interval as clamp_email_poll_interval,
)
from server.collector.email_config import (
    default_imap_port,
    normalize_allowlist,
    normalize_folders,
)
from server.collector.http_poll_helpers import (
    DEFAULT_MAX_CONTENT_CHARS,
    DEFAULT_TIMEOUT_SECONDS,
    MAX_HEADERS,
    clamp_max_content_chars,
    clamp_timeout_seconds,
)
from server.collector.poll_config import clamp_poll_interval
from server.domain.collector_platforms import COLLECTOR_PLATFORMS_WITH_LIST_ENRICHMENT
from server.secrets import MASKED_SECRET
from server.services.sources.channels import list_source_channels, list_source_channels_batch
from server.services.sources.credentials import parse_credentials
from server.wire.serializers import serialize_source

_PlatformInfoFn = Callable[[Any, list[dict[str, Any]]], Awaitable[list[dict[str, Any]]]]


def discord_channel_info(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(raw.get("id") or ""),
        "name": str(raw.get("name") or ""),
        "platformChannelId": str(raw.get("id") or ""),
        "guildName": str(raw.get("guild_name") or ""),
    }


async def discord_bot_info_batch(db: Any, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """List DiscordBotInfo for many sources using stored channel subscriptions."""
    if not rows:
        return []
    source_ids = [str(row["id"]) for row in rows]
    channels_by_source = await list_source_channels_batch(db, source_ids, "discord")
    return [
        {
            "source": serialize_source(row),
            "channels": [
                {
                    "id": channel["platformId"],
                    "name": channel.get("channelName") or "",
                    "platformChannelId": channel["platformId"],
                    "guildName": "",
                }
                for channel in channels_by_source.get(str(row["id"]), [])
            ],
        }
        for row in rows
    ]


async def rss_feed_info(
    db: Any,
    row: dict[str, Any],
    *,
    channels: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    credentials = parse_credentials(row)
    source_id = str(row["id"])
    if channels is None:
        channels = await list_source_channels(db, source_id, "rss")
    return {
        "source": serialize_source(row),
        "feedUrl": credentials.get("feed_url") or "",
        "pollIntervalSeconds": clamp_poll_interval(credentials.get("poll_interval_seconds")),
        "channel": channels[0] if channels else None,
        "lastError": row.get("last_error"),
        "lastSuccessAt": row.get("last_connected_at"),
    }


def mqtt_broker_info(row: dict[str, Any]) -> dict[str, Any]:
    credentials = parse_credentials(row)
    topics = credentials.get("topics")
    return {
        "source": serialize_source(row),
        "brokerUrl": credentials.get("broker_url") or "",
        "topics": topics if isinstance(topics, list) else [],
        "clientId": credentials.get("client_id") or "",
        "lastError": row.get("last_error"),
        "lastSuccessAt": row.get("last_connected_at"),
    }


async def http_source_info(
    db: Any,
    row: dict[str, Any],
    *,
    channels: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    credentials = parse_credentials(row)
    source_id = str(row["id"])
    if channels is None:
        channels = await list_source_channels(db, source_id, "http")
    headers = credentials.get("headers")
    if not isinstance(headers, dict):
        headers = {}
    auth_type = str(credentials.get("auth_type") or "none")
    return {
        "source": serialize_source(row),
        "url": credentials.get("url") or "",
        "method": str(credentials.get("method") or "GET").upper(),
        "authType": auth_type,
        "bearerToken": MASKED_SECRET if auth_type == "bearer" and credentials.get("bearer_token") else None,
        "basicUsername": credentials.get("basic_username") or None,
        "basicPassword": (
            MASKED_SECRET if auth_type == "basic" and credentials.get("basic_password") is not None else None
        ),
        "headers": {str(k): str(v) for k, v in list(headers.items())[:MAX_HEADERS]},
        "bodyType": str(credentials.get("body_type") or "none"),
        "body": credentials.get("body"),
        "pollIntervalSeconds": clamp_poll_interval(credentials.get("poll_interval_seconds")),
        "maxContentChars": clamp_max_content_chars(credentials.get("max_content_chars", DEFAULT_MAX_CONTENT_CHARS)),
        "timeoutSeconds": clamp_timeout_seconds(credentials.get("timeout_seconds", DEFAULT_TIMEOUT_SECONDS)),
        "channel": channels[0] if channels else None,
        "lastError": row.get("last_error"),
        "lastSuccessAt": row.get("last_connected_at"),
    }


def email_mailbox_info(row: dict[str, Any], channels: list[dict[str, Any]]) -> dict[str, Any]:
    credentials = parse_credentials(row)
    folder_cursors = credentials.get("folder_cursors") or {}
    if not isinstance(folder_cursors, dict):
        folder_cursors = {}
    use_ssl = bool(credentials.get("use_ssl", True))
    return {
        "source": serialize_source(row),
        "imapHost": credentials.get("imap_host") or "",
        "imapPort": int(credentials.get("imap_port") or default_imap_port(use_ssl=use_ssl)),
        "useSsl": use_ssl,
        "username": credentials.get("username") or "",
        "folders": normalize_folders(credentials.get("folders")),
        "pollIntervalSeconds": clamp_email_poll_interval(credentials.get("poll_interval_seconds")),
        "initialSyncDays": int(credentials.get("initial_sync_days") or 7),
        "initialSyncMaxMessages": int(credentials.get("initial_sync_max_messages") or 100),
        "senderAllowlist": normalize_allowlist(credentials.get("sender_allowlist")),
        "markAsRead": bool(credentials.get("mark_as_read", False)),
        "folderCursors": {str(k): int(v) for k, v in folder_cursors.items()},
        "channels": channels,
        "lastError": row.get("last_error"),
        "lastSuccessAt": row.get("last_connected_at"),
    }


async def _discord_info(db: Any, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return await discord_bot_info_batch(db, rows)


async def _rss_info(db: Any, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    channels_by_source = await list_source_channels_batch(db, [str(row["id"]) for row in rows], "rss")
    return [await rss_feed_info(db, row, channels=channels_by_source.get(str(row["id"]), [])) for row in rows]


async def _http_info(db: Any, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    channels_by_source = await list_source_channels_batch(db, [str(row["id"]) for row in rows], "http")
    return [await http_source_info(db, row, channels=channels_by_source.get(str(row["id"]), [])) for row in rows]


async def _email_info(db: Any, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    channels_by_source = await list_source_channels_batch(db, [str(row["id"]) for row in rows], "email")
    return [email_mailbox_info(row, channels_by_source.get(str(row["id"]), [])) for row in rows]


async def _mqtt_info(_db: Any, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [mqtt_broker_info(row) for row in rows]


_PRESENTERS: dict[str, _PlatformInfoFn] = {
    "discord": _discord_info,
    "rss": _rss_info,
    "http": _http_info,
    "mqtt": _mqtt_info,
    "email": _email_info,
}

if set(_PRESENTERS) != COLLECTOR_PLATFORMS_WITH_LIST_ENRICHMENT:
    raise RuntimeError(
        "sources list enrichment map must match "
        "COLLECTOR_PLATFORMS_WITH_LIST_ENRICHMENT "
        f"({sorted(_PRESENTERS)!r} != "
        f"{sorted(COLLECTOR_PLATFORMS_WITH_LIST_ENRICHMENT)!r})"
    )


async def present_sources(db: Any, platform: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Enriched list payload for one collector platform."""
    return await _PRESENTERS[platform](db, rows)

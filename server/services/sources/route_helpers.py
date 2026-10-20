"""Shared source helpers used by source services and platform route modules."""

from __future__ import annotations

from typing import Any

from server.api.deps import require_row
from server.queries import sources_queries
from server.services.sources.channels import list_source_channels, list_source_channels_batch
from server.services.sources.credentials import parse_credentials
from server.services.sources.login_response import add_source_response, add_source_response_from_login
from server.services.sources.records import create_source_row
from server.wire.serializers import serialize_source

__all__ = [
    "add_source_response",
    "add_source_response_from_login",
    "bind_source_channel",
    "create_source_row",
    "get_source_row",
    "list_source_channels",
    "list_source_channels_batch",
    "parse_credentials",
    "source_connect_error_response",
    "source_status_response",
    "sync_source_channels",
]


async def get_source_row(db: Any, source_id: str) -> dict[str, Any]:
    return await require_row(db, "sources", "Source", source_id)


async def bind_source_channel(db: Any, source_id: str, platform: str, platform_id: str, channel_name: str) -> None:
    """Atomically upsert an authoritative channel row and link it to the source."""
    await sources_queries.bind_source_channel(db, source_id, platform, platform_id, channel_name)


async def source_status_response(
    db: Any,
    source_id: str,
    *,
    status: str,
    error_message: str | None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Shared connect/update status body: source + status + errorMessage (+ optional extras)."""
    row = await get_source_row(db, source_id)
    payload: dict[str, Any] = {
        "source": serialize_source(row),
        "status": status,
        "errorMessage": error_message,
    }
    if extra:
        payload.update(extra)
    return payload


async def source_connect_error_response(
    db: Any,
    source_id: str,
    *,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Standard connect-failure body for RSS/MQTT/Discord/Email create endpoints."""
    row = await get_source_row(db, source_id)
    return await source_status_response(
        db,
        source_id,
        status="error",
        error_message=row.get("last_error"),
        extra=extra,
    )


async def sync_source_channels(
    db: Any,
    source_id: str,
    platform: str,
    bindings: list[tuple[str, str]],
) -> None:
    """Atomically replace links, refresh authoritative names, and prune orphans."""
    await sources_queries.sync_source_channels(db, source_id, platform, bindings)

"""RSS connect/patch hooks.

Collector helpers are looked up on ``manager_sources`` at call time so tests can
stub ``server.collector.manager_sources``.
"""

from __future__ import annotations

from typing import Any

from server.collector import manager_sources
from server.collector.poll_config import clamp_poll_interval
from server.errors import VALIDATION_ERROR, http_error
from server.queries import sources_queries
from server.services.sources.credentials import merge_rss_credentials
from server.services.sources.registry_types import (
    SourceConnectSpec,
    SourcePatchContext,
    SourceSetupContext,
    _update_via,
)
from server.services.sources.route_helpers import (
    bind_source_channel,
    get_source_row,
    source_connect_error_response,
    source_status_response,
)
from server.wire.serializer_domains.sources import serialize_channel, serialize_source


def _rss_create_credentials(body: Any) -> dict[str, Any]:
    return {
        "feed_url": body.feedUrl,
        "poll_interval_seconds": clamp_poll_interval(body.pollIntervalSeconds),
    }


def _rss_create_name(body: Any, _credentials: dict[str, Any]) -> str:
    return str(body.name or body.feedUrl)


def _rss_create_feed_title(result: Any, body: Any) -> str:
    return str((result or {}).get("feed_title") or "") or (body.name or body.feedUrl)


def _rss_merge(existing: dict[str, Any], body: Any) -> dict[str, Any]:
    feed_url = (body.feedUrl or existing.get("feed_url") or "").strip()
    if not feed_url:
        raise http_error(400, "Feed URL is required", error_code=VALIDATION_ERROR)
    if body.pollIntervalSeconds is not None:
        poll_interval = clamp_poll_interval(body.pollIntervalSeconds)
    else:
        poll_interval = clamp_poll_interval(existing.get("poll_interval_seconds"))
    return merge_rss_credentials(existing, feed_url=feed_url, poll_interval_seconds=poll_interval)


def _rss_patch_name(body: Any, row: dict[str, Any], merged: dict[str, Any]) -> str:
    feed_url = str(merged.get("feed_url") or "")
    return str(body.name or row.get("name") or feed_url)


def _rss_connect_name(ctx: SourceSetupContext) -> str | None:
    feed_title = _rss_create_feed_title(ctx.result, ctx.body)
    return ctx.body.name or feed_title


async def _connect_rss(
    collector: Any,
    source_id: str,
    credentials: dict[str, Any],
    body: Any,
) -> dict[str, Any]:
    return await manager_sources.create_rss_feed(
        collector,
        source_id,
        body.feedUrl,
        poll_interval_seconds=credentials["poll_interval_seconds"],
    )


async def _rss_response(
    db: Any,
    source_id: str,
    *,
    status: str,
    error_message: str | None,
    feed_title: str = "",
    platform: str = "rss",
) -> dict[str, Any]:
    row = await get_source_row(db, source_id)
    channel_row = await sources_queries.fetch_linked_channel_row(db, source_id, platform)
    return await source_status_response(
        db,
        source_id,
        status=status,
        error_message=error_message,
        extra={
            "channel": serialize_channel(channel_row) if channel_row else None,
            "feedTitle": feed_title or row.get("name") or "",
        },
    )


async def _rss_connect_error(db: Any, source_id: str, _error: str) -> dict[str, Any]:
    return await source_connect_error_response(
        db,
        source_id,
        extra={"channel": None, "feedTitle": ""},
    )


async def _rss_connect_success(ctx: SourceSetupContext) -> dict[str, Any]:
    feed_title = _rss_create_feed_title(ctx.result, ctx.body)
    channel_row = await sources_queries.fetch_channel_row(ctx.db, "rss", ctx.body.feedUrl)
    return {
        "source": serialize_source(await get_source_row(ctx.db, ctx.source_id)),
        "channel": serialize_channel(channel_row) if channel_row else None,
        "feedTitle": feed_title,
        "status": "connected",
        "errorMessage": None,
    }


async def _rss_after_connect(ctx: SourceSetupContext) -> None:
    feed_title = _rss_create_feed_title(ctx.result, ctx.body)
    await bind_source_channel(ctx.db, ctx.source_id, "rss", ctx.body.feedUrl, feed_title)


async def _rss_after_patch(ctx: SourcePatchContext) -> None:
    feed_title = str((ctx.result or {}).get("feed_title") or "") or ctx.display_name
    feed_url = str(ctx.merged.get("feed_url") or "")
    await bind_source_channel(ctx.db, ctx.source_id, "rss", feed_url, feed_title)


async def _rss_patch_error(db: Any, source_id: str, error_message: str | None) -> dict[str, Any]:
    return await _rss_response(db, source_id, status="error", error_message=error_message)


async def _rss_patch_success(ctx: SourcePatchContext) -> dict[str, Any]:
    feed_title = str((ctx.result or {}).get("feed_title") or "") or ctx.display_name
    return await _rss_response(
        ctx.db,
        ctx.source_id,
        status="connected",
        error_message=None,
        feed_title=feed_title,
    )


RSS_SOURCE_SPEC = SourceConnectSpec(
    platform="rss",
    platform_label="RSS",
    wrong_platform_message="Source is not an RSS feed",
    build_credentials=_rss_create_credentials,
    create_display_name=_rss_create_name,
    connect_collector=_connect_rss,
    update_collector=_update_via("update_rss_feed"),
    merge_credentials=_rss_merge,
    patch_display_name=_rss_patch_name,
    connect_name=_rss_connect_name,
    connect_error=_rss_connect_error,
    connect_success=_rss_connect_success,
    patch_error=_rss_patch_error,
    patch_success=_rss_patch_success,
    after_connect=_rss_after_connect,
    after_patch=_rss_after_patch,
)

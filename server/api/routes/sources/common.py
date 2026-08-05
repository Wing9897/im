"""Platform-agnostic source endpoints (list/delete/reconnect/refresh).

Shared source helpers live in ``helpers.py``; platform modules import them
directly. This module owns the shared FastAPI router and generic source routes.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Awaitable, Callable

from fastapi import APIRouter, Request, Response

from server.api.deps import API_DEPS, get_collector, get_db
from server.api.routes.sources.helpers import (
    add_source_response,
    get_source_row,
    list_source_channels_batch,
)
from server.api.schemas.responses import (
    AddSourceResponse,
    DiscordBotInfoResponse,
    EmailMailboxInfoResponse,
    HttpSourceInfoResponse,
    MqttBrokerInfoResponse,
    RefreshAllSourcesResponse,
    RssFeedInfoResponse,
    SourceResponse,
)
from server.errors import COLLECTOR_UNAVAILABLE, NOT_FOUND, VALIDATION_ERROR, http_error
from server.queries import sources_queries
from server.source_status import mark_source_connected, set_source_error
from server.wire.serializers import serialize_source

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/sources", tags=["sources"], dependencies=API_DEPS)

_REFRESH_ALL_CONCURRENCY = 10

__all__ = [
    "router",
    "list_sources",
    "list_discord_sources",
    "list_telegram_sources",
    "list_rss_sources",
    "list_http_sources",
    "list_mqtt_sources",
    "list_email_sources",
    "delete_source",
    "reconnect_source",
    "refresh_all_sources",
]

# ── listing / deletion / reconnect ────────────────────────────────────────

_PlatformInfoFn = Callable[[Any, list[dict[str, Any]]], Awaitable[list[dict[str, Any]]]]
_PLATFORM_INFO_FNS: dict[str, _PlatformInfoFn] | None = None


def _platform_info_fns() -> dict[str, _PlatformInfoFn]:
    """Lazy registry to avoid import cycles with platform route modules."""
    global _PLATFORM_INFO_FNS
    if _PLATFORM_INFO_FNS is not None:
        return _PLATFORM_INFO_FNS

    from server.api.routes.sources.discord import discord_bot_info_batch
    from server.api.routes.sources.email import email_mailbox_info
    from server.api.routes.sources.feeds import mqtt_broker_info, rss_feed_info
    from server.api.routes.sources.http import http_source_info
    from server.domain.collector_platforms import COLLECTOR_PLATFORMS_WITH_LIST_ENRICHMENT

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

    async def _mqtt_info(db: Any, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
        return [mqtt_broker_info(row) for row in rows]

    _PLATFORM_INFO_FNS = {
        "discord": _discord_info,
        "rss": _rss_info,
        "http": _http_info,
        "mqtt": _mqtt_info,
        "email": _email_info,
    }
    if set(_PLATFORM_INFO_FNS) != COLLECTOR_PLATFORMS_WITH_LIST_ENRICHMENT:
        raise RuntimeError(
            "sources list enrichment map must match "
            "COLLECTOR_PLATFORMS_WITH_LIST_ENRICHMENT "
            f"({sorted(_PLATFORM_INFO_FNS)!r} != "
            f"{sorted(COLLECTOR_PLATFORMS_WITH_LIST_ENRICHMENT)!r})"
        )
    return _PLATFORM_INFO_FNS


@router.get("", response_model=list[SourceResponse])
async def list_sources(request: Request) -> list[dict]:
    """Return Source[] for all sources.

    Platform-scoped lists use typed paths: GET /sources/{telegram,discord,rss,http,mqtt,email}.
    Query parameter ``platform`` is rejected with 400 (hard-cut; use typed aliases).
    """
    if "platform" in request.query_params:
        raise http_error(
            400,
            "Query parameter 'platform' is not supported; use GET /sources/{platform}",
            error_code=VALIDATION_ERROR,
        )
    return await _list_sources_for_platform(request, None)


async def _list_sources_for_platform(request: Request, platform: str | None) -> list[dict]:
    """Internal helper for typed platform list handlers (and unfiltered GET /sources)."""
    db = get_db(request)
    info_fn = _platform_info_fns().get(platform) if platform else None
    # Typed platform paths that decrypt credentials keep SELECT *; serialize-only paths
    # project explicit columns without the credentials blob.
    if info_fn is not None:
        assert platform is not None
        rows = await sources_queries.fetch_source_rows_for_platform(db, platform, include_credentials=True)
        return await info_fn(db, rows)
    if platform:
        rows = await sources_queries.fetch_source_rows_for_platform(db, platform, include_credentials=False)
    else:
        rows = await sources_queries.fetch_all_source_list_rows(db)
    return [serialize_source(row) for row in rows]


@router.get("/telegram", response_model=list[SourceResponse])
async def list_telegram_sources(request: Request) -> list[dict]:
    return await _list_sources_for_platform(request, "telegram")


@router.get("/discord", response_model=list[DiscordBotInfoResponse])
async def list_discord_sources(request: Request) -> list[dict]:
    return await _list_sources_for_platform(request, "discord")


@router.get("/rss", response_model=list[RssFeedInfoResponse])
async def list_rss_sources(request: Request) -> list[dict]:
    return await _list_sources_for_platform(request, "rss")


@router.get("/http", response_model=list[HttpSourceInfoResponse])
async def list_http_sources(request: Request) -> list[dict]:
    return await _list_sources_for_platform(request, "http")


@router.get("/mqtt", response_model=list[MqttBrokerInfoResponse])
async def list_mqtt_sources(request: Request) -> list[dict]:
    return await _list_sources_for_platform(request, "mqtt")


@router.get("/email", response_model=list[EmailMailboxInfoResponse])
async def list_email_sources(request: Request) -> list[dict]:
    return await _list_sources_for_platform(request, "email")


@router.delete("/{source_id}", status_code=204)
async def delete_source(request: Request, source_id: str) -> Response:
    db = get_db(request)
    await get_source_row(db, source_id)
    collector = get_collector(request)
    if collector is not None:
        await collector.stop_adapter(source_id)
    await sources_queries.delete_source(db, source_id)
    return Response(status_code=204)


@router.post(
    "/{source_id}/reconnect",
    response_model=AddSourceResponse,
    response_model_exclude_unset=True,
)
async def reconnect_source(request: Request, source_id: str) -> dict:
    db = get_db(request)
    await get_source_row(db, source_id)
    collector = get_collector(request)
    if collector is None:
        raise http_error(
            503,
            "Collector is not running",
            error_code=COLLECTOR_UNAVAILABLE,
        )
    try:
        result = await collector.reconnect_source(source_id)
    except KeyError as exc:
        raise http_error(404, str(exc), error_code=NOT_FOUND) from exc
    if result.get("connected"):
        await mark_source_connected(db, source_id)
    else:
        adapter = collector.adapters.get(source_id)
        error = (adapter.state.last_error if adapter is not None else None) or "Reconnect failed"
        await set_source_error(db, source_id, error)
    row = await get_source_row(db, source_id)
    next_step = "connected" if result.get("connected") else "error"
    return add_source_response(row, next_step)


@router.post("/refresh-all", response_model=RefreshAllSourcesResponse)
async def refresh_all_sources(request: Request) -> dict:
    db = get_db(request)
    collector = get_collector(request)
    rows = await sources_queries.fetch_all_source_rows(db)

    async def _resolve_status(row: dict[str, Any]) -> tuple[str, str]:
        source_id = str(row["id"])
        status = str(row.get("status") or "disconnected")
        if collector is not None:
            try:
                check = await collector.check_connection(source_id)
                status = "connected" if check.get("connected") else check.get("status", status)
            except KeyError:
                pass  # no live adapter; fall back to the stored status
            except Exception as exc:  # noqa: BLE001 — one source must not stop the sweep
                logger.warning("refresh-all check failed for %s: %s", source_id, exc)
                status = "error"
        return source_id, status

    sem = asyncio.Semaphore(_REFRESH_ALL_CONCURRENCY)

    async def _limited_resolve(row: dict[str, Any]) -> tuple[str, str]:
        async with sem:
            return await _resolve_status(row)

    resolved = await asyncio.gather(*[_limited_resolve(row) for row in rows])

    connected = 0
    verification_required: list[str] = []
    errors: list[str] = []
    for source_id, status in resolved:
        if status == "connected":
            connected += 1
        elif status == "error":
            errors.append(source_id)
        else:
            verification_required.append(source_id)

    return {
        "totalSources": len(rows),
        "connectedCount": connected,
        "verificationRequiredCount": len(verification_required),
        "errorCount": len(errors),
        "verificationRequiredSourceIds": verification_required,
        "errorSourceIds": errors,
    }

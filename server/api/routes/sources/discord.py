"""Discord bot sources: connect + channel subscription."""

from __future__ import annotations

import logging

from fastapi import Request

from server.api.deps import get_collector, get_db
from server.api.routes.sources.common import router
from server.api.schemas.requests.sources import (
    DiscordBotBody,
    DiscordBotPatchBody,
    DiscordSubscribeBody,
)
from server.api.schemas.responses import AddDiscordBotResponse, DiscordSubscribeResponse
from server.collector import manager_sources
from server.errors import COLLECTOR_UNAVAILABLE, NOT_FOUND, http_error
from server.services.sources.registry import DISCORD_SOURCE_SPEC, connect_registered_source, patch_registered_source
from server.services.sources.route_helpers import bind_source_channel, get_source_row

logger = logging.getLogger(__name__)


@router.post("/discord", response_model=AddDiscordBotResponse)
async def create_discord_bot(request: Request, body: DiscordBotBody) -> dict:
    return await connect_registered_source(request, DISCORD_SOURCE_SPEC, body)


@router.patch("/discord/{source_id}", response_model=AddDiscordBotResponse)
async def update_discord_bot(request: Request, source_id: str, body: DiscordBotPatchBody) -> dict:
    return await patch_registered_source(request, DISCORD_SOURCE_SPEC, source_id, body)


@router.post("/discord/{source_id}/subscribe", response_model=DiscordSubscribeResponse)
async def subscribe_discord_channels(request: Request, source_id: str, body: DiscordSubscribeBody) -> dict:
    db = get_db(request)
    await get_source_row(db, source_id)
    collector = get_collector(request)
    if collector is None:
        raise http_error(
            503,
            "Collector is not running",
            error_code=COLLECTOR_UNAVAILABLE,
        )

    # Best-effort channel-name lookup from the live bot.
    name_map: dict[str, str] = {}
    try:
        adapter = collector.adapters.get(source_id)
        if adapter is not None:
            for ch in await adapter.list_channels():
                name_map[str(ch["id"])] = str(ch.get("name") or "")
    except Exception:  # noqa: BLE001 — names are cosmetic; ids are authoritative
        logger.exception("Discord channel-name lookup failed for %s", source_id)

    for channel_id in body.channelIds:
        await bind_source_channel(db, source_id, "discord", channel_id, name_map.get(channel_id, ""))

    try:
        await manager_sources.subscribe_discord_channels(collector, source_id, body.channelIds)
    except KeyError as exc:
        raise http_error(404, str(exc), error_code=NOT_FOUND) from exc
    return {"status": "subscribed"}

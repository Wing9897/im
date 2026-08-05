"""Discord bot sources: connect + channel subscription."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import Request

from server.api.deps import get_collector, get_db
from server.api.routes.sources.common import router
from server.api.routes.sources.helpers import (
    bind_source_channel,
    connect_source,
    finalize_source_setup,
    get_source_row,
    list_source_channels,
    list_source_channels_batch,
    parse_credentials,
    source_connect_error_response,
    source_status_response,
)
from server.api.routes.sources.patch_helpers import PatchSourceFlow, patch_source
from server.api.schemas.requests import DiscordBotBody, DiscordBotPatchBody, DiscordSubscribeBody
from server.api.schemas.responses import AddDiscordBotResponse, DiscordSubscribeResponse
from server.collector import manager_sources
from server.errors import COLLECTOR_UNAVAILABLE, NOT_FOUND, VALIDATION_ERROR, http_error
from server.queries import sources_queries
from server.secrets import MASKED_SECRET
from server.source_status import mark_source_connected
from server.util import utc_now_iso
from server.wire.serializers import serialize_source

logger = logging.getLogger(__name__)


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


@router.post("/discord", response_model=AddDiscordBotResponse)
async def create_discord_bot(request: Request, body: DiscordBotBody) -> dict:
    db = get_db(request)
    display_name = (body.name.strip() if body.name else "") or "Discord Bot"
    source_id, result, error = await connect_source(
        request,
        platform="discord",
        name=display_name,
        credentials={"bot_token": body.botToken},
        connect=lambda collector, source_id: manager_sources.create_discord_bot(collector, source_id, body.botToken),
    )
    if error is not None:
        return await source_connect_error_response(db, source_id, extra={"channels": []})

    async def _finalize() -> dict[str, Any]:
        await mark_source_connected(db, source_id, name=display_name)
        row = await get_source_row(db, source_id)
        return {
            "source": serialize_source(row),
            "channels": [discord_channel_info(ch) for ch in (result or {}).get("channels", [])],
            "status": "connected",
            "errorMessage": None,
        }

    return await finalize_source_setup(request, source_id, _finalize)


async def _discord_response(db: Any, source_id: str, *, status: str, error_message: str | None) -> dict:
    channels = await list_source_channels(db, source_id, "discord")
    return await source_status_response(
        db,
        source_id,
        status=status,
        error_message=error_message,
        extra={
            "channels": [
                {
                    "id": channel["platformId"],
                    "name": channel.get("channelName") or "",
                    "platformChannelId": channel["platformId"],
                    "guildName": "",
                }
                for channel in channels
            ],
        },
    )


def _merge_discord_credentials(existing: dict[str, Any], body: DiscordBotPatchBody) -> dict[str, Any]:
    merged = dict(existing)
    if body.botToken is not None and body.botToken not in ("", MASKED_SECRET):
        merged["bot_token"] = body.botToken.strip()
    return merged


@router.patch("/discord/{source_id}", response_model=AddDiscordBotResponse)
async def update_discord_bot(request: Request, source_id: str, body: DiscordBotPatchBody) -> dict:
    db = get_db(request)
    row = await get_source_row(db, source_id)
    if str(row.get("platform")) != "discord":
        raise http_error(400, "Source is not a Discord bot", error_code=VALIDATION_ERROR)

    if body.name is None and body.botToken is None:
        raise http_error(400, "No Discord fields to update", error_code=VALIDATION_ERROR)

    existing = parse_credentials(row)
    merged = _merge_discord_credentials(existing, body)
    if not merged.get("bot_token"):
        raise http_error(400, "Bot token is required", error_code=VALIDATION_ERROR)

    display_name = (body.name.strip() if body.name is not None else None) or row.get("name") or "Discord Bot"
    token_changed = body.botToken is not None and body.botToken not in ("", MASKED_SECRET)

    if not token_changed:
        # Name-only: skip adapter replace.
        await sources_queries.update_source_name(db, source_id, str(display_name), utc_now_iso())
        status = str(row.get("status") or "disconnected")
        return await _discord_response(db, source_id, status=status, error_message=None)

    return await patch_source(
        request,
        source_id,
        PatchSourceFlow(
            display_name=str(display_name),
            merged_credentials=merged,
            update_collector=lambda collector, aid, creds: manager_sources.update_discord_bot(collector, aid, creds),
            after_success=_discord_after_success,
            error_response=lambda db, aid, err: _discord_response(db, aid, status="error", error_message=err),
            success_response=lambda db, aid, result: _discord_success(db, aid, result),
            platform_label="Discord",
            mutate_credentials=lambda current: _merge_discord_credentials(current, body),
        ),
    )


async def _discord_after_success(_db: Any, _aid: str, _result: Any) -> None:
    return None


async def _discord_success(db: Any, source_id: str, result: Any) -> dict:
    row = await get_source_row(db, source_id)
    live_channels = (result or {}).get("channels") or []
    if live_channels:
        channels = [discord_channel_info(ch) for ch in live_channels]
    else:
        stored = await list_source_channels(db, source_id, "discord")
        channels = [
            {
                "id": channel["platformId"],
                "name": channel.get("channelName") or "",
                "platformChannelId": channel["platformId"],
                "guildName": "",
            }
            for channel in stored
        ]
    return {
        "source": serialize_source(row),
        "channels": channels,
        "status": "connected",
        "errorMessage": None,
    }


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

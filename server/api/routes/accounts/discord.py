"""Discord bot accounts: connect + channel subscription."""

from __future__ import annotations

import logging
from typing import Any, Optional

from fastapi import Request
from pydantic import BaseModel

from server.account_status import mark_account_connected
from server.api.deps import get_collector, get_db
from server.api.routes.accounts.common import router
from server.api.routes.accounts.helpers import (
    bind_account_channel,
    connect_source_account,
    finalize_source_account,
    get_account_row,
    list_account_channels,
    list_account_channels_batch,
    parse_credentials,
    source_account_status_response,
    source_connect_error_response,
)
from server.api.routes.accounts.patch_helpers import PatchSourceAccountFlow, patch_source_account
from server.api.schemas.responses import AddDiscordBotResponse, DiscordSubscribeResponse
from server.collector import manager_sources
from server.errors import COLLECTOR_UNAVAILABLE, NOT_FOUND, VALIDATION_ERROR, http_error
from server.queries import accounts_queries
from server.secrets import MASKED_SECRET
from server.util import utc_now_iso
from server.wire.serializers import serialize_account

logger = logging.getLogger(__name__)


class DiscordBotBody(BaseModel):
    botToken: str
    name: Optional[str] = None


class DiscordBotPatchBody(BaseModel):
    botToken: Optional[str] = None
    name: Optional[str] = None


class DiscordSubscribeBody(BaseModel):
    channelIds: list[str]


def discord_channel_info(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(raw.get("id") or ""),
        "name": str(raw.get("name") or ""),
        "platformChannelId": str(raw.get("id") or ""),
        "guildName": str(raw.get("guild_name") or ""),
    }


async def discord_bot_info_batch(db: Any, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """List DiscordBotInfo for many accounts using stored channel subscriptions."""
    if not rows:
        return []
    account_ids = [str(row["id"]) for row in rows]
    channels_by_account = await list_account_channels_batch(db, account_ids, "discord")
    return [
        {
            "account": serialize_account(row),
            "channels": [
                {
                    "id": channel["platformId"],
                    "name": channel.get("channelName") or "",
                    "platformChannelId": channel["platformId"],
                    "guildName": "",
                }
                for channel in channels_by_account.get(str(row["id"]), [])
            ],
        }
        for row in rows
    ]


@router.post("/discord", response_model=AddDiscordBotResponse)
async def create_discord_bot(request: Request, body: DiscordBotBody) -> dict:
    db = get_db(request)
    display_name = (body.name.strip() if body.name else "") or "Discord Bot"
    account_id, result, error = await connect_source_account(
        request,
        platform="discord",
        name=display_name,
        credentials={"bot_token": body.botToken},
        connect=lambda collector, account_id: manager_sources.create_discord_bot(collector, account_id, body.botToken),
    )
    if error is not None:
        return await source_connect_error_response(db, account_id, extra={"channels": []})

    async def _finalize() -> dict[str, Any]:
        await mark_account_connected(db, account_id, name=display_name)
        row = await get_account_row(db, account_id)
        return {
            "account": serialize_account(row),
            "channels": [discord_channel_info(ch) for ch in (result or {}).get("channels", [])],
            "status": "connected",
            "errorMessage": None,
        }

    return await finalize_source_account(request, account_id, _finalize)


async def _discord_response(db: Any, account_id: str, *, status: str, error_message: str | None) -> dict:
    channels = await list_account_channels(db, account_id, "discord")
    return await source_account_status_response(
        db,
        account_id,
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


@router.patch("/discord/{account_id}", response_model=AddDiscordBotResponse)
async def update_discord_bot(request: Request, account_id: str, body: DiscordBotPatchBody) -> dict:
    db = get_db(request)
    row = await get_account_row(db, account_id)
    if str(row.get("platform")) != "discord":
        raise http_error(400, "Account is not a Discord bot", error_code=VALIDATION_ERROR)

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
        await accounts_queries.update_account_name(db, account_id, str(display_name), utc_now_iso())
        status = str(row.get("status") or "disconnected")
        return await _discord_response(db, account_id, status=status, error_message=None)

    return await patch_source_account(
        request,
        account_id,
        PatchSourceAccountFlow(
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


async def _discord_success(db: Any, account_id: str, result: Any) -> dict:
    row = await get_account_row(db, account_id)
    live_channels = (result or {}).get("channels") or []
    if live_channels:
        channels = [discord_channel_info(ch) for ch in live_channels]
    else:
        stored = await list_account_channels(db, account_id, "discord")
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
        "account": serialize_account(row),
        "channels": channels,
        "status": "connected",
        "errorMessage": None,
    }


@router.post("/discord/{account_id}/subscribe", response_model=DiscordSubscribeResponse)
async def subscribe_discord_channels(request: Request, account_id: str, body: DiscordSubscribeBody) -> dict:
    db = get_db(request)
    await get_account_row(db, account_id)
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
        adapter = collector.adapters.get(account_id)
        if adapter is not None:
            for ch in await adapter.list_channels():
                name_map[str(ch["id"])] = str(ch.get("name") or "")
    except Exception:  # noqa: BLE001 — names are cosmetic; ids are authoritative
        logger.exception("Discord channel-name lookup failed for %s", account_id)

    for channel_id in body.channelIds:
        await bind_account_channel(db, account_id, "discord", channel_id, name_map.get(channel_id, ""))

    try:
        await manager_sources.subscribe_discord_channels(collector, account_id, body.channelIds)
    except KeyError as exc:
        raise http_error(404, str(exc), error_code=NOT_FOUND) from exc
    return {"status": "subscribed"}

"""Discord connect/patch hooks.

Collector helpers are looked up on ``manager_sources`` at call time so tests can
stub ``server.collector.manager_sources``.
"""

from __future__ import annotations

from typing import Any

from server.collector import manager_sources
from server.errors import VALIDATION_ERROR, http_error
from server.queries import sources_queries
from server.secrets import MASKED_SECRET
from server.services.sources.channels import list_source_channels
from server.services.sources.credentials import merge_discord_credentials
from server.services.sources.presenters import discord_channel_info
from server.services.sources.registry_types import (
    SourceConnectSpec,
    SourcePatchContext,
    SourceSetupContext,
    _keep_display_name,
    _update_via,
)
from server.services.sources.route_helpers import (
    get_source_row,
    source_connect_error_response,
    source_status_response,
)
from server.util import utc_now_iso
from server.wire.serializer_domains.sources import serialize_source


def _discord_create_credentials(body: Any) -> dict[str, Any]:
    return {"bot_token": body.botToken}


def _discord_create_name(body: Any, _credentials: dict[str, Any]) -> str:
    return (body.name.strip() if body.name else "") or "Discord Bot"


def _discord_merge(existing: dict[str, Any], body: Any) -> dict[str, Any]:
    return merge_discord_credentials(existing, bot_token=body.botToken)


def _discord_patch_name(body: Any, row: dict[str, Any], _merged: dict[str, Any]) -> str:
    stripped = body.name.strip() if body.name is not None else None
    return str(stripped or row.get("name") or "Discord Bot")


def _discord_validate(merged: dict[str, Any], _body: Any, _row: dict[str, Any]) -> None:
    if not merged.get("bot_token"):
        raise http_error(400, "Bot token is required", error_code=VALIDATION_ERROR)


def _discord_reject_empty(body: Any) -> bool:
    return body.name is None and body.botToken is None


async def _connect_discord(
    collector: Any,
    source_id: str,
    _credentials: dict[str, Any],
    body: Any,
) -> dict[str, Any]:
    return await manager_sources.create_discord_bot(collector, source_id, body.botToken)


async def _discord_connect_error(db: Any, source_id: str, _error: str) -> dict[str, Any]:
    return await source_connect_error_response(db, source_id, extra={"channels": []})


async def _discord_connect_success(ctx: SourceSetupContext) -> dict[str, Any]:
    row = await get_source_row(ctx.db, ctx.source_id)
    channels = [discord_channel_info(ch) for ch in (ctx.result or {}).get("channels", [])]
    return {
        "source": serialize_source(row),
        "channels": channels,
        "status": "connected",
        "errorMessage": None,
    }


def _discord_stored_channel(channel: dict[str, Any]) -> dict[str, Any]:
    platform_id = channel["platformId"]
    return {
        "id": platform_id,
        "name": channel.get("channelName") or "",
        "platformChannelId": platform_id,
        "guildName": "",
    }


async def _discord_stored_response(
    db: Any,
    source_id: str,
    *,
    status: str,
    error_message: str | None,
) -> dict[str, Any]:
    channels = await list_source_channels(db, source_id, "discord")
    return await source_status_response(
        db,
        source_id,
        status=status,
        error_message=error_message,
        extra={"channels": [_discord_stored_channel(channel) for channel in channels]},
    )


async def _discord_patch_error(db: Any, source_id: str, error_message: str | None) -> dict[str, Any]:
    return await _discord_stored_response(db, source_id, status="error", error_message=error_message)


async def _discord_patch_success(ctx: SourcePatchContext) -> dict[str, Any]:
    row = await get_source_row(ctx.db, ctx.source_id)
    live_channels = (ctx.result or {}).get("channels") or []
    if live_channels:
        channels = [discord_channel_info(ch) for ch in live_channels]
    else:
        stored = await list_source_channels(ctx.db, ctx.source_id, "discord")
        channels = [_discord_stored_channel(channel) for channel in stored]
    return {
        "source": serialize_source(row),
        "channels": channels,
        "status": "connected",
        "errorMessage": None,
    }


async def _discord_name_only(ctx: SourcePatchContext) -> dict[str, Any] | None:
    token_changed = ctx.body.botToken is not None and ctx.body.botToken not in ("", MASKED_SECRET)
    if token_changed:
        return None
    await sources_queries.update_source_name(ctx.db, ctx.source_id, ctx.display_name, utc_now_iso())
    status = str(ctx.row.get("status") or "disconnected")
    return await _discord_stored_response(ctx.db, ctx.source_id, status=status, error_message=None)


DISCORD_SOURCE_SPEC = SourceConnectSpec(
    platform="discord",
    platform_label="Discord",
    wrong_platform_message="Source is not a Discord bot",
    build_credentials=_discord_create_credentials,
    create_display_name=_discord_create_name,
    connect_collector=_connect_discord,
    update_collector=_update_via("update_discord_bot"),
    merge_credentials=_discord_merge,
    patch_display_name=_discord_patch_name,
    connect_name=_keep_display_name,
    connect_error=_discord_connect_error,
    connect_success=_discord_connect_success,
    patch_error=_discord_patch_error,
    patch_success=_discord_patch_success,
    validate_merged=_discord_validate,
    reject_empty_patch=_discord_reject_empty,
    empty_patch_message="No Discord fields to update",
    name_only_patch=_discord_name_only,
    remerge_on_patch=True,
)

"""Declarative connect/patch specs for collector platforms.

Mirrors the frontend source-plugin registry: one spec per platform that shares
``connect_source`` → ``finalize_source_setup`` → ``mark_source_connected`` and
``PatchSourceFlow``. Telegram phone/QR/2FA login stays in ``telegram_login``.
Inbound HTTP webhook ingest stays on the messages route.

Collector helpers are looked up on ``manager_sources`` at call time so tests can
stub ``server.collector.manager_sources``.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, Final, NoReturn

from fastapi import Request

from server.api.deps import get_collector, get_db
from server.collector import manager_sources
from server.collector.email_config import (
    build_email_credentials,
    email_channel_platform_id,
    normalize_folders,
)
from server.collector.http_poll_helpers import normalize_http_credentials
from server.collector.poll_config import clamp_poll_interval
from server.domain.collector_platforms import COLLECTOR_PLATFORMS
from server.errors import VALIDATION_ERROR, http_error
from server.queries import sources_queries
from server.secrets import MASKED_SECRET
from server.services.sources.channels import list_source_channels
from server.services.sources.connect import connect_source, finalize_source_setup
from server.services.sources.credentials import (
    merge_discord_credentials,
    merge_email_mailbox_credentials,
    merge_http_credentials,
    merge_mqtt_credentials,
    merge_rss_credentials,
    parse_credentials,
)
from server.services.sources.patch_flow import PatchSourceFlow, patch_source
from server.services.sources.presenters import discord_channel_info, http_source_info
from server.services.sources.route_helpers import (
    bind_source_channel,
    get_source_row,
    source_connect_error_response,
    source_status_response,
    sync_source_channels,
)
from server.source_status import mark_source_connected
from server.util import utc_now_iso
from server.wire.serializers import serialize_channel, serialize_source

_CredentialsFn = Callable[[Any], dict[str, Any]]
_MergeFn = Callable[[dict[str, Any], Any], dict[str, Any]]
_ConnectCollector = Callable[[Any, str, dict[str, Any], Any], Awaitable[dict[str, Any]]]
_UpdateCollector = Callable[[Any, str, dict[str, Any]], Awaitable[Any]]


@dataclass(frozen=True, slots=True)
class SourceSetupContext:
    """Values available while finalizing a successful connect."""

    db: Any
    source_id: str
    body: Any
    credentials: dict[str, Any]
    display_name: str
    result: Any


@dataclass(frozen=True, slots=True)
class SourcePatchContext:
    """Values available while applying a source PATCH."""

    db: Any
    source_id: str
    body: Any
    row: dict[str, Any]
    merged: dict[str, Any]
    display_name: str
    result: Any = None


@dataclass(frozen=True, slots=True)
class SourceConnectSpec:
    """Connect and patch hooks for one collector platform.

    ``credential_value_error_is_validation`` maps ``ValueError`` from credential
    build/merge to HTTP 400 (HTTP poll). Other platforms let it propagate.
    ``remerge_on_patch`` re-applies ``merge_credentials`` inside the credential
    transaction (Discord, Email). Otherwise the precomputed merge is stored.
    ``connect_name`` returning ``None`` marks connected without renaming.
    """

    platform: str
    platform_label: str
    wrong_platform_message: str
    build_credentials: _CredentialsFn
    create_display_name: Callable[[Any, dict[str, Any]], str]
    connect_collector: _ConnectCollector
    update_collector: _UpdateCollector
    merge_credentials: _MergeFn
    patch_display_name: Callable[[Any, dict[str, Any], dict[str, Any]], str]
    connect_name: Callable[[SourceSetupContext], str | None]
    connect_error: Callable[[Any, str, str], Awaitable[dict[str, Any]]]
    connect_success: Callable[[SourceSetupContext], Awaitable[dict[str, Any]]]
    patch_error: Callable[[Any, str, str | None], Awaitable[dict[str, Any]]]
    patch_success: Callable[[SourcePatchContext], Awaitable[dict[str, Any]]]
    after_connect: Callable[[SourceSetupContext], Awaitable[None]] | None = None
    after_patch: Callable[[SourcePatchContext], Awaitable[None]] | None = None
    validate_merged: Callable[[dict[str, Any], Any, dict[str, Any]], None] | None = None
    reject_empty_patch: Callable[[Any], bool] | None = None
    empty_patch_message: str = ""
    name_only_patch: Callable[[SourcePatchContext], Awaitable[dict[str, Any] | None]] | None = None
    remerge_on_patch: bool = False
    credential_value_error_is_validation: bool = False


def _reraise_credential_error(spec: SourceConnectSpec, exc: ValueError) -> NoReturn:
    if spec.credential_value_error_is_validation:
        raise http_error(400, str(exc), error_code=VALIDATION_ERROR) from exc
    raise exc


def _update_via(method_name: str) -> _UpdateCollector:
    async def _update(collector: Any, source_id: str, credentials: dict[str, Any]) -> Any:
        update = getattr(manager_sources, method_name)
        return await update(collector, source_id, credentials)

    return _update


def _keep_display_name(ctx: SourceSetupContext) -> str | None:
    return ctx.display_name


def _patch_context(
    *,
    db: Any,
    source_id: str,
    body: Any,
    row: dict[str, Any],
    merged: dict[str, Any],
    display_name: str,
    result: Any = None,
) -> SourcePatchContext:
    return SourcePatchContext(
        db=db,
        source_id=source_id,
        body=body,
        row=row,
        merged=merged,
        display_name=display_name,
        result=result,
    )


async def _sync_email_folder_channels(
    db: Any,
    source_id: str,
    *,
    host: str,
    port: int,
    username: str,
    folders: list[str],
) -> None:
    bindings = [(email_channel_platform_id(host, port, username, folder), folder) for folder in folders]
    await sync_source_channels(db, source_id, "email", bindings)


# ── Discord ─────────────────────────────────────────────────────────────


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


async def _discord_patch_error(db: Any, source_id: str, error_message: str | None) -> dict[str, Any]:
    return await _discord_stored_response(db, source_id, status="error", error_message=error_message)


async def _discord_patch_success(ctx: SourcePatchContext) -> dict[str, Any]:
    row = await get_source_row(ctx.db, ctx.source_id)
    live_channels = (ctx.result or {}).get("channels") or []
    if live_channels:
        channels = [discord_channel_info(ch) for ch in live_channels]
    else:
        stored = await list_source_channels(ctx.db, ctx.source_id, "discord")
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


async def _discord_name_only(ctx: SourcePatchContext) -> dict[str, Any] | None:
    token_changed = ctx.body.botToken is not None and ctx.body.botToken not in ("", MASKED_SECRET)
    if token_changed:
        return None
    await sources_queries.update_source_name(ctx.db, ctx.source_id, ctx.display_name, utc_now_iso())
    status = str(ctx.row.get("status") or "disconnected")
    return await _discord_stored_response(ctx.db, ctx.source_id, status=status, error_message=None)


# ── HTTP poll (webhook ingest is not this spec) ─────────────────────────


def _http_create_credentials(body: Any) -> dict[str, Any]:
    return normalize_http_credentials(
        {
            "url": body.url,
            "method": body.method,
            "auth_type": body.authType,
            "bearer_token": body.bearerToken,
            "basic_username": body.basicUsername,
            "basic_password": body.basicPassword,
            "headers": body.headers,
            "body_type": body.bodyType,
            "body": body.body,
            "poll_interval_seconds": body.pollIntervalSeconds,
            "max_content_chars": body.maxContentChars,
            "timeout_seconds": body.timeoutSeconds,
        }
    )


def _http_create_name(body: Any, credentials: dict[str, Any]) -> str:
    return str(body.name or credentials["url"])


def _http_merge(existing: dict[str, Any], body: Any) -> dict[str, Any]:
    return merge_http_credentials(
        existing,
        url=body.url,
        method=body.method,
        auth_type=body.authType,
        bearer_token=body.bearerToken,
        basic_username=body.basicUsername,
        basic_password=body.basicPassword,
        headers=body.headers,
        body_type=body.bodyType,
        body=body.body,
        poll_interval_seconds=body.pollIntervalSeconds,
        max_content_chars=body.maxContentChars,
        timeout_seconds=body.timeoutSeconds,
    )


def _http_patch_name(body: Any, row: dict[str, Any], merged: dict[str, Any]) -> str:
    return str(body.name or row.get("name") or merged["url"])


async def _connect_http(
    collector: Any,
    source_id: str,
    credentials: dict[str, Any],
    _body: Any,
) -> dict[str, Any]:
    return await manager_sources.create_http_source(collector, source_id, credentials)


async def _http_response(
    db: Any,
    source_id: str,
    *,
    status: str,
    error_message: str | None,
) -> dict[str, Any]:
    row = await get_source_row(db, source_id)
    info = await http_source_info(db, row)
    return {
        **info,
        "status": status,
        "errorMessage": error_message,
    }


async def _http_connect_error(db: Any, source_id: str, error: str) -> dict[str, Any]:
    return await _http_response(db, source_id, status="error", error_message=error)


async def _http_connect_success(ctx: SourceSetupContext) -> dict[str, Any]:
    return await _http_response(ctx.db, ctx.source_id, status="connected", error_message=None)


async def _http_after_connect(ctx: SourceSetupContext) -> None:
    url = ctx.credentials["url"]
    await bind_source_channel(ctx.db, ctx.source_id, "http", url, url)


async def _http_after_patch(ctx: SourcePatchContext) -> None:
    url = ctx.merged["url"]
    await bind_source_channel(ctx.db, ctx.source_id, "http", url, url)


async def _http_patch_error(db: Any, source_id: str, error_message: str | None) -> dict[str, Any]:
    return await _http_response(db, source_id, status="error", error_message=error_message)


async def _http_patch_success(ctx: SourcePatchContext) -> dict[str, Any]:
    return await _http_response(ctx.db, ctx.source_id, status="connected", error_message=None)


# ── Email ───────────────────────────────────────────────────────────────


def _email_create_credentials(body: Any) -> dict[str, Any]:
    return build_email_credentials(
        imap_host=body.imapHost,
        imap_port=body.imapPort,
        use_ssl=body.useSsl,
        username=body.username,
        password=body.password,
        folders=body.folders,
        poll_interval_seconds=body.pollIntervalSeconds,
        initial_sync_days=body.initialSyncDays,
        initial_sync_max_messages=body.initialSyncMaxMessages,
        sender_allowlist=body.senderAllowlist,
        mark_as_read=body.markAsRead,
    )


def _email_create_name(body: Any, _credentials: dict[str, Any]) -> str:
    return str(body.name or body.username)


def _email_merge(existing: dict[str, Any], body: Any) -> dict[str, Any]:
    return merge_email_mailbox_credentials(
        existing,
        reset_cursors=body.resetCursors,
        imap_host=body.imapHost,
        imap_port=body.imapPort,
        use_ssl=body.useSsl,
        username=body.username,
        password=body.password,
        folders=body.folders,
        poll_interval_seconds=body.pollIntervalSeconds,
        initial_sync_days=body.initialSyncDays,
        initial_sync_max_messages=body.initialSyncMaxMessages,
        sender_allowlist=body.senderAllowlist,
        mark_as_read=body.markAsRead,
    )


def _email_patch_name(body: Any, row: dict[str, Any], merged: dict[str, Any]) -> str:
    return str(body.name or row.get("name") or merged["username"])


def _email_validate(merged: dict[str, Any], _body: Any, _row: dict[str, Any]) -> None:
    if not merged.get("imap_host") or not merged.get("username") or not merged.get("password"):
        raise http_error(
            400,
            "IMAP host, username, and password are required",
            error_code=VALIDATION_ERROR,
        )


async def _connect_email(
    collector: Any,
    source_id: str,
    credentials: dict[str, Any],
    _body: Any,
) -> dict[str, Any]:
    return await manager_sources.create_email_mailbox(collector, source_id, credentials)


async def _email_response(
    db: Any,
    source_id: str,
    *,
    status: str,
    error_message: str | None,
) -> dict[str, Any]:
    channels = await list_source_channels(db, source_id, "email")
    return await source_status_response(
        db,
        source_id,
        status=status,
        error_message=error_message,
        extra={"channels": channels},
    )


async def _email_connect_error(db: Any, source_id: str, error: str) -> dict[str, Any]:
    return await _email_response(db, source_id, status="error", error_message=error)


async def _email_connect_success(ctx: SourceSetupContext) -> dict[str, Any]:
    return await _email_response(ctx.db, ctx.source_id, status="connected", error_message=None)


async def _email_after_connect(ctx: SourceSetupContext) -> None:
    folders = normalize_folders((ctx.result or {}).get("folders") or ctx.credentials.get("folders"))
    await _sync_email_folder_channels(
        ctx.db,
        ctx.source_id,
        host=str(ctx.credentials["imap_host"]),
        port=int(ctx.credentials["imap_port"]),
        username=ctx.credentials["username"],
        folders=folders,
    )


async def _email_after_patch(ctx: SourcePatchContext) -> None:
    folders = normalize_folders(ctx.merged.get("folders"))
    await _sync_email_folder_channels(
        ctx.db,
        ctx.source_id,
        host=str(ctx.merged["imap_host"]),
        port=int(ctx.merged["imap_port"]),
        username=str(ctx.merged["username"]),
        folders=folders,
    )


async def _email_patch_error(db: Any, source_id: str, error_message: str | None) -> dict[str, Any]:
    return await _email_response(db, source_id, status="error", error_message=error_message)


async def _email_patch_success(ctx: SourcePatchContext) -> dict[str, Any]:
    return await _email_response(ctx.db, ctx.source_id, status="connected", error_message=None)


# ── MQTT ────────────────────────────────────────────────────────────────


def _mqtt_create_credentials(body: Any) -> dict[str, Any]:
    return {
        "broker_url": body.brokerUrl,
        "topics": body.topics,
        "username": body.username,
        "password": body.password,
        "client_id": body.clientId,
    }


def _mqtt_create_name(body: Any, _credentials: dict[str, Any]) -> str:
    return str(body.brokerUrl)


def _mqtt_merge(existing: dict[str, Any], body: Any) -> dict[str, Any]:
    return merge_mqtt_credentials(
        existing,
        broker_url=body.brokerUrl,
        topics=body.topics,
        username=body.username,
        password=body.password,
        client_id=body.clientId,
    )


def _mqtt_patch_name(body: Any, row: dict[str, Any], merged: dict[str, Any]) -> str:
    broker_url = str(merged.get("broker_url") or "").strip()
    return str(body.name or row.get("name") or broker_url)


def _mqtt_validate(merged: dict[str, Any], _body: Any, _row: dict[str, Any]) -> None:
    broker_url = str(merged.get("broker_url") or "").strip()
    topics = merged.get("topics")
    if not broker_url:
        raise http_error(400, "Broker URL is required", error_code=VALIDATION_ERROR)
    if not isinstance(topics, list) or not topics:
        raise http_error(400, "At least one topic is required", error_code=VALIDATION_ERROR)


def _mqtt_connect_name(_ctx: SourceSetupContext) -> str | None:
    return None


async def _connect_mqtt(
    collector: Any,
    source_id: str,
    _credentials: dict[str, Any],
    body: Any,
) -> dict[str, Any]:
    return await manager_sources.create_mqtt_broker(
        collector,
        source_id,
        body.brokerUrl,
        body.topics,
        username=body.username,
        password=body.password,
        client_id=body.clientId,
    )


async def _mqtt_response(db: Any, source_id: str, *, status: str, error_message: str | None) -> dict[str, Any]:
    return await source_status_response(db, source_id, status=status, error_message=error_message)


async def _mqtt_connect_error(db: Any, source_id: str, _error: str) -> dict[str, Any]:
    return await source_connect_error_response(db, source_id)


async def _mqtt_connect_success(ctx: SourceSetupContext) -> dict[str, Any]:
    return {
        "source": serialize_source(await get_source_row(ctx.db, ctx.source_id)),
        "status": "connected",
        "errorMessage": None,
    }


async def _mqtt_after_connect(ctx: SourceSetupContext) -> None:
    await bind_source_channel(ctx.db, ctx.source_id, "mqtt", ctx.body.brokerUrl, ctx.body.brokerUrl)


async def _mqtt_after_patch(ctx: SourcePatchContext) -> None:
    broker_url = str(ctx.merged.get("broker_url") or "").strip()
    await bind_source_channel(ctx.db, ctx.source_id, "mqtt", broker_url, broker_url)


async def _mqtt_patch_error(db: Any, source_id: str, error_message: str | None) -> dict[str, Any]:
    return await _mqtt_response(db, source_id, status="error", error_message=error_message)


async def _mqtt_patch_success(ctx: SourcePatchContext) -> dict[str, Any]:
    return await _mqtt_response(ctx.db, ctx.source_id, status="connected", error_message=None)


# ── RSS ─────────────────────────────────────────────────────────────────


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


# ── Registry ────────────────────────────────────────────────────────────


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

HTTP_SOURCE_SPEC = SourceConnectSpec(
    platform="http",
    platform_label="HTTP",
    wrong_platform_message="Source is not an HTTP source",
    build_credentials=_http_create_credentials,
    create_display_name=_http_create_name,
    connect_collector=_connect_http,
    update_collector=_update_via("update_http_source"),
    merge_credentials=_http_merge,
    patch_display_name=_http_patch_name,
    connect_name=_keep_display_name,
    connect_error=_http_connect_error,
    connect_success=_http_connect_success,
    patch_error=_http_patch_error,
    patch_success=_http_patch_success,
    after_connect=_http_after_connect,
    after_patch=_http_after_patch,
    credential_value_error_is_validation=True,
)

MQTT_SOURCE_SPEC = SourceConnectSpec(
    platform="mqtt",
    platform_label="MQTT",
    wrong_platform_message="Source is not an MQTT broker",
    build_credentials=_mqtt_create_credentials,
    create_display_name=_mqtt_create_name,
    connect_collector=_connect_mqtt,
    update_collector=_update_via("update_mqtt_broker"),
    merge_credentials=_mqtt_merge,
    patch_display_name=_mqtt_patch_name,
    connect_name=_mqtt_connect_name,
    connect_error=_mqtt_connect_error,
    connect_success=_mqtt_connect_success,
    patch_error=_mqtt_patch_error,
    patch_success=_mqtt_patch_success,
    after_connect=_mqtt_after_connect,
    after_patch=_mqtt_after_patch,
    validate_merged=_mqtt_validate,
)

EMAIL_SOURCE_SPEC = SourceConnectSpec(
    platform="email",
    platform_label="Email",
    wrong_platform_message="Source is not an email mailbox",
    build_credentials=_email_create_credentials,
    create_display_name=_email_create_name,
    connect_collector=_connect_email,
    update_collector=_update_via("update_email_mailbox"),
    merge_credentials=_email_merge,
    patch_display_name=_email_patch_name,
    connect_name=_keep_display_name,
    connect_error=_email_connect_error,
    connect_success=_email_connect_success,
    patch_error=_email_patch_error,
    patch_success=_email_patch_success,
    after_connect=_email_after_connect,
    after_patch=_email_after_patch,
    validate_merged=_email_validate,
    remerge_on_patch=True,
)

SOURCE_CONNECT_SPECS: Final[tuple[SourceConnectSpec, ...]] = (
    DISCORD_SOURCE_SPEC,
    RSS_SOURCE_SPEC,
    HTTP_SOURCE_SPEC,
    MQTT_SOURCE_SPEC,
    EMAIL_SOURCE_SPEC,
)

_CONNECT_SPEC_ORDER: Final[tuple[str, ...]] = tuple(
    platform for platform in COLLECTOR_PLATFORMS if platform != "telegram"
)

if tuple(spec.platform for spec in SOURCE_CONNECT_SPECS) != _CONNECT_SPEC_ORDER:
    raise RuntimeError(
        "SOURCE_CONNECT_SPECS must follow COLLECTOR_PLATFORMS excluding telegram login "
        f"({tuple(spec.platform for spec in SOURCE_CONNECT_SPECS)!r} != {_CONNECT_SPEC_ORDER!r})"
    )


async def connect_registered_source(request: Request, spec: SourceConnectSpec, body: Any) -> dict[str, Any]:
    """Create a source from ``spec`` and return the existing JSON body."""
    db = get_db(request)
    collector = get_collector(request)
    try:
        credentials = spec.build_credentials(body)
    except ValueError as exc:
        _reraise_credential_error(spec, exc)
    display_name = spec.create_display_name(body, credentials)
    source_id, result, error = await connect_source(
        db,
        collector,
        platform=spec.platform,
        name=display_name,
        credentials=credentials,
        connect=lambda collector, source_id: spec.connect_collector(collector, source_id, credentials, body),
    )
    if error is not None:
        return await spec.connect_error(db, source_id, error)

    async def _finalize() -> dict[str, Any]:
        ctx = SourceSetupContext(
            db=db,
            source_id=source_id,
            body=body,
            credentials=credentials,
            display_name=display_name,
            result=result,
        )
        if spec.after_connect is not None:
            await spec.after_connect(ctx)
        await mark_source_connected(db, source_id, name=spec.connect_name(ctx))
        return await spec.connect_success(ctx)

    return await finalize_source_setup(db, collector, source_id, _finalize)


def _remerge(spec: SourceConnectSpec, body: Any) -> Callable[[dict[str, Any]], dict[str, Any]]:
    def _mutate(current: dict[str, Any]) -> dict[str, Any]:
        return spec.merge_credentials(current, body)

    return _mutate


async def patch_registered_source(
    request: Request,
    spec: SourceConnectSpec,
    source_id: str,
    body: Any,
) -> dict[str, Any]:
    """Patch a source from ``spec`` and return the existing JSON body."""
    db = get_db(request)
    row = await get_source_row(db, source_id)
    if str(row.get("platform")) != spec.platform:
        raise http_error(400, spec.wrong_platform_message, error_code=VALIDATION_ERROR)
    if spec.reject_empty_patch is not None and spec.reject_empty_patch(body):
        raise http_error(400, spec.empty_patch_message, error_code=VALIDATION_ERROR)

    existing = parse_credentials(row)
    try:
        merged = spec.merge_credentials(existing, body)
    except ValueError as exc:
        _reraise_credential_error(spec, exc)
    if spec.validate_merged is not None:
        spec.validate_merged(merged, body, row)
    display_name = str(spec.patch_display_name(body, row, merged))
    if spec.name_only_patch is not None:
        early = await spec.name_only_patch(
            _patch_context(
                db=db,
                source_id=source_id,
                body=body,
                row=row,
                merged=merged,
                display_name=display_name,
            )
        )
        if early is not None:
            return early

    async def _after_success(callback_db: Any, callback_id: str, result: Any) -> None:
        if spec.after_patch is None:
            return
        await spec.after_patch(
            _patch_context(
                db=callback_db,
                source_id=callback_id,
                body=body,
                row=row,
                merged=merged,
                display_name=display_name,
                result=result,
            )
        )

    async def _error_response(callback_db: Any, callback_id: str, error_message: str | None) -> dict[str, Any]:
        return await spec.patch_error(callback_db, callback_id, error_message)

    async def _success_response(callback_db: Any, callback_id: str, result: Any) -> dict[str, Any]:
        return await spec.patch_success(
            _patch_context(
                db=callback_db,
                source_id=callback_id,
                body=body,
                row=row,
                merged=merged,
                display_name=display_name,
                result=result,
            )
        )

    return await patch_source(
        request,
        source_id,
        PatchSourceFlow(
            display_name=display_name,
            merged_credentials=merged,
            update_collector=spec.update_collector,
            after_success=_after_success,
            error_response=_error_response,
            success_response=_success_response,
            platform_label=spec.platform_label,
            mutate_credentials=_remerge(spec, body) if spec.remerge_on_patch else None,
        ),
    )

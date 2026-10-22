"""Email mailbox connect/patch hooks.

Collector helpers are looked up on ``manager_sources`` at call time so tests can
stub ``server.collector.manager_sources``.
"""

from __future__ import annotations

from typing import Any

from server.collector import manager_sources
from server.collector.email_config import (
    build_email_credentials,
    email_channel_platform_id,
    normalize_folders,
)
from server.errors import VALIDATION_ERROR, http_error
from server.services.sources.channels import list_source_channels
from server.services.sources.credentials import merge_email_mailbox_credentials
from server.services.sources.registry_types import (
    SourceConnectSpec,
    SourcePatchContext,
    SourceSetupContext,
    _keep_display_name,
    _update_via,
)
from server.services.sources.route_helpers import source_status_response, sync_source_channels


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

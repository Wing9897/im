"""Email (IMAP) mailbox sources: create, update, and list."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import Request

from server.api.deps import get_db
from server.api.routes.sources.common import router
from server.api.routes.sources.helpers import (
    connect_source,
    finalize_source_setup,
    get_source_row,
    list_source_channels,
    parse_credentials,
    source_status_response,
    sync_source_channels,
)
from server.api.routes.sources.patch_helpers import PatchSourceFlow, patch_source
from server.api.schemas.requests import EmailMailboxBody, EmailMailboxPatchBody
from server.api.schemas.responses import AddEmailMailboxResponse
from server.collector import manager_sources
from server.collector.email_config import (
    build_email_credentials,
    clamp_poll_interval,
    default_imap_port,
    email_channel_platform_id,
    merge_email_credentials,
    normalize_allowlist,
    normalize_folders,
)
from server.errors import VALIDATION_ERROR, http_error
from server.source_status import mark_source_connected
from server.wire.serializers import serialize_source

logger = logging.getLogger(__name__)


def credentials_from_body(body: EmailMailboxBody) -> dict[str, Any]:
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


def patch_to_credentials(existing: dict[str, Any], body: EmailMailboxPatchBody) -> dict[str, Any]:
    patch: dict[str, Any] = {"reset_cursors": body.resetCursors}
    if body.imapHost is not None:
        patch["imap_host"] = body.imapHost
    if body.imapPort is not None:
        patch["imap_port"] = body.imapPort
    if body.useSsl is not None:
        patch["use_ssl"] = body.useSsl
    if body.username is not None:
        patch["username"] = body.username
    if body.password is not None:
        patch["password"] = body.password
    if body.folders is not None:
        patch["folders"] = body.folders
    if body.pollIntervalSeconds is not None:
        patch["poll_interval_seconds"] = body.pollIntervalSeconds
    if body.initialSyncDays is not None:
        patch["initial_sync_days"] = body.initialSyncDays
    if body.initialSyncMaxMessages is not None:
        patch["initial_sync_max_messages"] = body.initialSyncMaxMessages
    if body.senderAllowlist is not None:
        patch["sender_allowlist"] = body.senderAllowlist
    if body.markAsRead is not None:
        patch["mark_as_read"] = body.markAsRead
    return merge_email_credentials(existing, patch)


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
        "pollIntervalSeconds": clamp_poll_interval(credentials.get("poll_interval_seconds")),
        "initialSyncDays": int(credentials.get("initial_sync_days") or 7),
        "initialSyncMaxMessages": int(credentials.get("initial_sync_max_messages") or 100),
        "senderAllowlist": normalize_allowlist(credentials.get("sender_allowlist")),
        "markAsRead": bool(credentials.get("mark_as_read", False)),
        "folderCursors": {str(k): int(v) for k, v in folder_cursors.items()},
        "channels": channels,
        "lastError": row.get("last_error"),
        "lastSuccessAt": row.get("last_connected_at"),
    }


async def sync_email_folder_channels(
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


async def _email_response(db: Any, source_id: str, *, status: str, error_message: str | None) -> dict:
    channels = await list_source_channels(db, source_id, "email")
    return await source_status_response(
        db,
        source_id,
        status=status,
        error_message=error_message,
        extra={"channels": channels},
    )


@router.post("/email", response_model=AddEmailMailboxResponse)
async def create_email_mailbox(request: Request, body: EmailMailboxBody) -> dict:
    db = get_db(request)
    credentials = credentials_from_body(body)
    display_name = body.name or body.username

    source_id, result, error = await connect_source(
        request,
        platform="email",
        name=display_name,
        credentials=credentials,
        connect=lambda collector, source_id: manager_sources.create_email_mailbox(collector, source_id, credentials),
    )
    if error is not None:
        return await _email_response(db, source_id, status="error", error_message=error)

    async def _finalize() -> dict[str, Any]:
        folders = normalize_folders((result or {}).get("folders") or credentials.get("folders"))
        await sync_email_folder_channels(
            db,
            source_id,
            host=str(credentials["imap_host"]),
            port=int(credentials["imap_port"]),
            username=credentials["username"],
            folders=folders,
        )
        await mark_source_connected(db, source_id, name=display_name)
        return await _email_response(db, source_id, status="connected", error_message=None)

    return await finalize_source_setup(request, source_id, _finalize)


@router.patch("/email/{source_id}", response_model=AddEmailMailboxResponse)
async def update_email_mailbox(request: Request, source_id: str, body: EmailMailboxPatchBody) -> dict:
    db = get_db(request)
    row = await get_source_row(db, source_id)
    if str(row.get("platform")) != "email":
        raise http_error(400, "Source is not an email mailbox", error_code=VALIDATION_ERROR)

    existing = parse_credentials(row)
    merged = patch_to_credentials(existing, body)
    if not merged.get("imap_host") or not merged.get("username") or not merged.get("password"):
        raise http_error(
            400,
            "IMAP host, username, and password are required",
            error_code=VALIDATION_ERROR,
        )

    display_name = body.name or row.get("name") or merged["username"]

    async def _after_success(db: Any, source_id: str, _result: Any) -> None:
        folders = normalize_folders(merged.get("folders"))
        await sync_email_folder_channels(
            db,
            source_id,
            host=str(merged["imap_host"]),
            port=int(merged["imap_port"]),
            username=str(merged["username"]),
            folders=folders,
        )

    return await patch_source(
        request,
        source_id,
        PatchSourceFlow(
            display_name=display_name,
            merged_credentials=merged,
            update_collector=lambda collector, aid, creds: manager_sources.update_email_mailbox(collector, aid, creds),
            after_success=_after_success,
            error_response=lambda db, aid, err: _email_response(db, aid, status="error", error_message=err),
            success_response=lambda db, aid, _result: _email_response(db, aid, status="connected", error_message=None),
            platform_label="Email",
            mutate_credentials=lambda current: patch_to_credentials(current, body),
        ),
    )

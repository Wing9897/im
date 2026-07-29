"""Channels routes: list-with-accounts and latest-messages.

There is deliberately no bare ``GET /api/v1/channels``: every caller needs the
account each channel belongs to, so the plain list was dead weight.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request

from server.api.channel_refs import parse_channel_key_csv
from server.api.deps import API_DEPS, get_db
from server.api.schemas.responses import (
    ChannelWithAccountResponse,
    MessageResponse,
)
from server.errors import VALIDATION_ERROR, http_error
from server.queries.channels_queries import (
    fetch_account_channel_rows,
    fetch_account_rows,
    fetch_channel_rows,
    fetch_latest_message_rows,
)
from server.wire.serializers import channel_key, serialize_account, serialize_channel, serialize_message

router = APIRouter(prefix="/api/v1/channels", tags=["channels"], dependencies=API_DEPS)

_MAX_LATEST_CHANNELS = 100


def _primary_account_name(account: dict | None) -> str | None:
    if not account:
        return None
    name = account.get("name")
    if name and str(name).strip():
        return str(name).strip()
    return None


@router.get("/with-accounts", response_model=list[ChannelWithAccountResponse])
async def list_channels_with_accounts(request: Request) -> list[dict]:
    """ChannelWithAccount[] — accountName populated server-side."""
    db = get_db(request)
    channels = await fetch_channel_rows(db)
    links = await fetch_account_channel_rows(db)
    by_channel: dict[str, list[str]] = {}
    for link in links:
        key = channel_key(str(link["platform"]), str(link["platform_id"]))
        by_channel.setdefault(key, []).append(str(link["account_id"]))

    account_rows = await fetch_account_rows(db)
    accounts_by_id = {str(row["id"]): serialize_account(row) for row in account_rows}

    result = []
    for row in channels:
        serialized = serialize_channel(row)
        account_ids = by_channel.get(serialized["id"], [])
        first = accounts_by_id.get(account_ids[0]) if account_ids else None
        serialized["accountIds"] = account_ids
        serialized["accountId"] = account_ids[0] if account_ids else None
        serialized["accountName"] = _primary_account_name(first)
        result.append(serialized)
    return result


@router.get("/latest-messages", response_model=dict[str, list[MessageResponse]])
async def latest_messages_by_channels(
    request: Request,
    channels: str,
    limit: int = 5,
) -> dict[str, list[dict[str, Any]]]:
    """Return the newest *limit* messages per channel key (``platform:platformId``)."""
    if limit < 1 or limit > 20:
        raise http_error(422, "limit must be between 1 and 20", error_code=VALIDATION_ERROR)
    channel_keys = parse_channel_key_csv(channels, max_keys=_MAX_LATEST_CHANNELS)
    if not channel_keys:
        return {}

    db = get_db(request)
    result: dict[str, list[dict[str, Any]]] = {
        channel_key(platform, platform_id): [] for platform, platform_id in channel_keys
    }
    rows = await fetch_latest_message_rows(db, channel_keys, limit=limit)
    for row in rows:
        key = channel_key(str(row["platform"]), str(row["platform_id"]))
        result[key].append(serialize_message(row))
    return result

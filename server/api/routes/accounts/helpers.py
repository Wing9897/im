"""Shared account helpers used by platform route modules and common endpoints.

Response shapes follow web/src/api/accounts/ and web/src/types/accounts.ts.
Platform-agnostic HTTP endpoints remain in ``common.py``.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Awaitable, Callable, Optional, TypeVar

from fastapi import Request

from server.account_status import set_account_error
from server.api.deps import get_collector, get_db, require_row
from server.queries import accounts_queries
from server.secrets import protect_text, unprotect_text
from server.util import new_id, parse_json_dict, utc_now_iso
from server.wire.serializers import serialize_account, serialize_channel

logger = logging.getLogger(__name__)

_ResultT = TypeVar("_ResultT")


# ── shared helpers ────────────────────────────────────────────────────────


async def get_account_row(db: Any, account_id: str) -> dict[str, Any]:
    return await require_row(db, "accounts", "Account", account_id)


async def create_account_row(
    db: Any,
    *,
    platform: str,
    name: str,
    credentials: dict[str, Any],
    status: str = "disconnected",
) -> dict[str, Any]:
    account_id = new_id()
    now = utc_now_iso()
    await accounts_queries.insert_account(
        db,
        account_id=account_id,
        platform=platform,
        name=name,
        status=status,
        credentials=protect_text(json.dumps(credentials, ensure_ascii=False)),
        now=now,
    )
    return await get_account_row(db, account_id)


def add_account_response(
    account_row: dict[str, Any],
    next_step: str,
    phone_code_hash: str | None = None,
    *,
    qr_url: str | None = None,
    qr_expires_at: str | None = None,
) -> dict[str, Any]:
    response: dict[str, Any] = {
        "account": serialize_account(account_row),
        "nextStep": next_step,
    }
    if next_step in ("code_required", "2fa_required", "qr_required"):
        response["pendingLoginStage"] = next_step
    if phone_code_hash is not None:
        response["phoneCodeHash"] = phone_code_hash
    if qr_url is not None:
        response["qrUrl"] = qr_url
    if qr_expires_at is not None:
        response["qrExpiresAt"] = qr_expires_at
    return response


def add_account_response_from_login(account_row: dict[str, Any], result: dict[str, Any]) -> dict[str, Any]:
    return add_account_response(
        account_row,
        str(result.get("next_step") or "error"),
        result.get("phone_code_hash"),
        qr_url=result.get("qr_url"),
        qr_expires_at=result.get("qr_expires_at"),
    )


def parse_credentials(row: dict[str, Any]) -> dict[str, Any]:
    return parse_json_dict(unprotect_text(row.get("credentials")))


# ── shared source-creation flow (Discord / RSS / MQTT / Email) ──────────────


async def compensate_source_adapter(collector: Any, account_id: str, context: str) -> str | None:
    """Best-effort teardown after a source flow fails; preserve replacement identity rules."""
    stop_adapter = getattr(collector, "stop_adapter", None)
    if stop_adapter is None:
        return None
    try:
        await stop_adapter(account_id)
    except Exception as exc:  # noqa: BLE001 — caller must preserve the primary failure
        logger.exception("Failed to compensate %s for %s", context, account_id)
        return str(exc)
    return None


async def finalize_source_account(
    request: Request,
    account_id: str,
    finalize: Callable[[], Awaitable[_ResultT]],
) -> _ResultT:
    """Run post-connect DB work, tearing down the live adapter on any failure."""
    try:
        return await finalize()
    except BaseException as exc:
        collector = get_collector(request)
        cleanup_error = None
        if collector is not None:
            cleanup_error = await compensate_source_adapter(collector, account_id, "post-connect source setup")
        if isinstance(exc, Exception):
            error = str(exc)
            if cleanup_error:
                error = f"{error}; adapter cleanup failed: {cleanup_error}"
            try:
                await set_account_error(get_db(request), account_id, error)
            except Exception:  # noqa: BLE001 — never replace the original setup failure
                logger.exception("Failed to persist post-connect source error for %s", account_id)
        raise


async def connect_source_account(
    request: Request,
    *,
    platform: str,
    name: str,
    credentials: dict[str, Any],
    connect: Callable[[Any, str], Awaitable[dict[str, Any]]],
) -> tuple[str, Optional[dict[str, Any]], Optional[str]]:
    """Create the account row and run the collector connect flow.

    Returns ``(account_id, result, error)`` — ``result`` is the collector's
    create_* payload on success; ``error`` carries the failure message when
    the collector is missing or the connect call raised (the account row is
    already marked errored in both cases).
    """
    db = get_db(request)
    account_row = await create_account_row(db, platform=platform, name=name, credentials=credentials)
    account_id = str(account_row["id"])

    collector = get_collector(request)
    if collector is None:
        await set_account_error(db, account_id, "Collector is not running")
        return account_id, None, "Collector is not running"

    try:
        result = await connect(collector, account_id)
    except asyncio.CancelledError:
        stop_adapter = getattr(collector, "stop_adapter", None)
        if stop_adapter is not None:
            try:
                await stop_adapter(account_id)
            except Exception:  # noqa: BLE001 — preserve task cancellation
                logger.exception("Failed to compensate cancelled %s connect for %s", platform, account_id)
        raise
    except Exception as exc:  # noqa: BLE001 — connect errors surface in the response body
        logger.warning("%s connect failed for %s: %s", platform, account_id, exc)
        error = str(exc)
        cleanup_error = await compensate_source_adapter(collector, account_id, f"{platform} connect")
        if cleanup_error:
            error = f"{error}; adapter cleanup failed: {cleanup_error}"
        await set_account_error(db, account_id, error)
        return account_id, None, error

    return account_id, result, None


async def bind_account_channel(db: Any, account_id: str, platform: str, platform_id: str, channel_name: str) -> None:
    """Atomically upsert an authoritative channel row and link it to the account."""
    await accounts_queries.bind_account_channel(db, account_id, platform, platform_id, channel_name)


async def source_account_status_response(
    db: Any,
    account_id: str,
    *,
    status: str,
    error_message: str | None,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Shared connect/update status body: account + status + errorMessage (+ optional extras)."""
    row = await get_account_row(db, account_id)
    payload: dict[str, Any] = {
        "account": serialize_account(row),
        "status": status,
        "errorMessage": error_message,
    }
    if extra:
        payload.update(extra)
    return payload


async def source_connect_error_response(
    db: Any,
    account_id: str,
    *,
    extra: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Standard connect-failure body for RSS/MQTT/Discord/Email create endpoints."""
    row = await get_account_row(db, account_id)
    return await source_account_status_response(
        db,
        account_id,
        status="error",
        error_message=row.get("last_error"),
        extra=extra,
    )


async def list_account_channels(db: Any, account_id: str, platform: str) -> list[dict[str, Any]]:
    rows = await accounts_queries.fetch_account_channel_rows(db, account_id, platform)
    return [serialize_channel(row) for row in rows]


async def list_account_channels_batch(
    db: Any,
    account_ids: list[str],
    platform: str,
) -> dict[str, list[dict[str, Any]]]:
    """Fetch channels for many accounts in one query (empty lists for accounts with no links)."""
    if not account_ids:
        return {}
    rows = await accounts_queries.fetch_account_channel_rows_batch(db, account_ids, platform)
    grouped: dict[str, list[dict[str, Any]]] = {account_id: [] for account_id in account_ids}
    for row in rows:
        account_id = str(row["account_id"])
        channel = {key: value for key, value in row.items() if key != "account_id"}
        grouped.setdefault(account_id, []).append(serialize_channel(channel))
    return grouped


async def sync_account_channels(
    db: Any,
    account_id: str,
    platform: str,
    bindings: list[tuple[str, str]],
) -> None:
    """Atomically replace links, refresh authoritative names, and prune orphans."""
    await accounts_queries.sync_account_channels(db, account_id, platform, bindings)

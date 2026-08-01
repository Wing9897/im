"""Shared PATCH flow for feed-style source accounts (RSS / MQTT / Email)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Awaitable, Callable

from fastapi import Request

from server.account_credentials import mutate_account_credentials
from server.account_status import mark_account_connected, set_account_error
from server.api.deps import get_collector, get_db
from server.api.routes.accounts.helpers import compensate_source_adapter

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PatchSourceAccountFlow:
    """Platform-specific hooks for a source-account PATCH."""

    display_name: str
    merged_credentials: dict[str, Any]
    update_collector: Callable[[Any, str, dict[str, Any]], Awaitable[Any]]
    after_success: Callable[[Any, str, Any], Awaitable[None]]
    error_response: Callable[[Any, str, str | None], Awaitable[dict[str, Any]]]
    success_response: Callable[[Any, str, Any], Awaitable[dict[str, Any]]]
    platform_label: str = "source"
    mutate_credentials: Callable[[dict[str, Any]], dict[str, Any]] | None = None


async def patch_source_account(
    request: Request,
    account_id: str,
    flow: PatchSourceAccountFlow,
) -> dict[str, Any]:
    """Atomically mutate creds → reconnect → after_success → mark connected."""
    db = get_db(request)
    mutation = flow.mutate_credentials or (lambda _current: dict(flow.merged_credentials))
    effective_credentials = await mutate_account_credentials(
        db,
        account_id,
        mutation,
        name=flow.display_name,
    )
    if effective_credentials is None:
        raise KeyError(f"No account {account_id}")

    collector = get_collector(request)
    if collector is None:
        await set_account_error(db, account_id, "Collector is not running")
        return await flow.error_response(db, account_id, "Collector is not running")

    try:
        result = await flow.update_collector(collector, account_id, effective_credentials)
    except Exception as exc:  # noqa: BLE001 — surface connect errors in response
        logger.warning(
            "%s update connect failed for %s: %s",
            flow.platform_label,
            account_id,
            exc,
        )
        await set_account_error(db, account_id, str(exc))
        return await flow.error_response(db, account_id, str(exc))

    try:
        await flow.after_success(db, account_id, result)
        await mark_account_connected(db, account_id, name=flow.display_name)
        return await flow.success_response(db, account_id, result)
    except BaseException as exc:
        cleanup_error = await compensate_source_adapter(
            collector, account_id, f"{flow.platform_label} post-update setup"
        )
        if isinstance(exc, Exception):
            error = str(exc)
            if cleanup_error:
                error = f"{error}; adapter cleanup failed: {cleanup_error}"
            try:
                await set_account_error(db, account_id, error)
            except Exception:  # noqa: BLE001 — preserve the original post-update failure
                logger.exception("Failed to persist %s post-update error for %s", flow.platform_label, account_id)
        raise

"""Shared PATCH flow for feed-style sources (RSS / MQTT / Email)."""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from fastapi import Request

from server.api.deps import get_collector, get_db
from server.api.routes.sources.helpers import compensate_source_adapter
from server.source_credentials import mutate_source_credentials
from server.source_status import mark_source_connected, set_source_error

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class PatchSourceFlow:
    """Platform-specific hooks for a source PATCH."""

    display_name: str
    merged_credentials: dict[str, Any]
    update_collector: Callable[[Any, str, dict[str, Any]], Awaitable[Any]]
    after_success: Callable[[Any, str, Any], Awaitable[None]]
    error_response: Callable[[Any, str, str | None], Awaitable[dict[str, Any]]]
    success_response: Callable[[Any, str, Any], Awaitable[dict[str, Any]]]
    platform_label: str = "source"
    mutate_credentials: Callable[[dict[str, Any]], dict[str, Any]] | None = None


async def patch_source(
    request: Request,
    source_id: str,
    flow: PatchSourceFlow,
) -> dict[str, Any]:
    """Atomically mutate creds → reconnect → after_success → mark connected."""
    db = get_db(request)
    mutation = flow.mutate_credentials or (lambda _current: dict(flow.merged_credentials))
    effective_credentials = await mutate_source_credentials(
        db,
        source_id,
        mutation,
        name=flow.display_name,
    )
    if effective_credentials is None:
        raise KeyError(f"No source {source_id}")

    collector = get_collector(request)
    if collector is None:
        await set_source_error(db, source_id, "Collector is not running")
        return await flow.error_response(db, source_id, "Collector is not running")

    try:
        result = await flow.update_collector(collector, source_id, effective_credentials)
    except Exception as exc:  # noqa: BLE001 — surface connect errors in response
        logger.warning(
            "%s update connect failed for %s: %s",
            flow.platform_label,
            source_id,
            exc,
        )
        await set_source_error(db, source_id, str(exc))
        return await flow.error_response(db, source_id, str(exc))

    try:
        await flow.after_success(db, source_id, result)
        await mark_source_connected(db, source_id, name=flow.display_name)
        return await flow.success_response(db, source_id, result)
    except BaseException as exc:
        cleanup_error = await compensate_source_adapter(
            collector, source_id, f"{flow.platform_label} post-update setup"
        )
        if isinstance(exc, Exception):
            error = str(exc)
            if cleanup_error:
                error = f"{error}; adapter cleanup failed: {cleanup_error}"
            try:
                await set_source_error(db, source_id, error)
            except Exception:  # noqa: BLE001 — preserve the original post-update failure
                logger.exception("Failed to persist %s post-update error for %s", flow.platform_label, source_id)
        raise

"""Create a source row and run the collector connect flow.

Callers pass ``Database`` and the collector. Success returns the collector
payload. Failure leaves the row in place with status ``error`` and stops the
adapter.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import Any, TypeVar

from server.db.database import Database
from server.services.sources.records import create_source_row
from server.source_status import set_source_error

logger = logging.getLogger(__name__)

_ResultT = TypeVar("_ResultT")


async def compensate_source_adapter(collector: Any, source_id: str, context: str) -> str | None:
    """Best-effort teardown after a source flow fails; preserve replacement identity rules."""
    stop_adapter = getattr(collector, "stop_adapter", None)
    if stop_adapter is None:
        return None
    try:
        await stop_adapter(source_id)
    except Exception as exc:  # noqa: BLE001 — caller must preserve the primary failure
        logger.exception("Failed to compensate %s for %s", context, source_id)
        return str(exc)
    return None


async def finalize_source_setup(
    db: Database,
    collector: Any | None,
    source_id: str,
    finalize: Callable[[], Awaitable[_ResultT]],
) -> _ResultT:
    """Run post-connect DB work, tearing down the live adapter on any failure."""
    try:
        return await finalize()
    except BaseException as exc:
        cleanup_error = None
        if collector is not None:
            cleanup_error = await compensate_source_adapter(collector, source_id, "post-connect source setup")
        if isinstance(exc, Exception):
            error = str(exc)
            if cleanup_error:
                error = f"{error}; adapter cleanup failed: {cleanup_error}"
            try:
                await set_source_error(db, source_id, error)
            except Exception:  # noqa: BLE001 — never replace the original setup failure
                logger.exception("Failed to persist post-connect source error for %s", source_id)
        raise


async def connect_source(
    db: Database,
    collector: Any | None,
    *,
    platform: str,
    name: str,
    credentials: dict[str, Any],
    connect: Callable[[Any, str], Awaitable[dict[str, Any]]],
) -> tuple[str, dict[str, Any] | None, str | None]:
    """Create the source row and run the collector connect flow.

    Returns ``(source_id, payload, error)``. ``payload`` is the collector
    create_* result on success. ``error`` is set when the collector is missing
    or connect raised; the row already exists with status ``error``, and a
    live adapter has been stopped.
    """
    source_row = await create_source_row(db, platform=platform, name=name, credentials=credentials)
    source_id = str(source_row["id"])

    if collector is None:
        await set_source_error(db, source_id, "Collector is not running")
        return source_id, None, "Collector is not running"

    try:
        result = await connect(collector, source_id)
    except asyncio.CancelledError:
        stop_adapter = getattr(collector, "stop_adapter", None)
        if stop_adapter is not None:
            try:
                await stop_adapter(source_id)
            except Exception:  # noqa: BLE001 — preserve task cancellation
                logger.exception("Failed to compensate cancelled %s connect for %s", platform, source_id)
        raise
    except Exception as exc:  # noqa: BLE001 — connect errors surface in the response body
        logger.warning("%s connect failed for %s: %s", platform, source_id, exc)
        error = str(exc)
        cleanup_error = await compensate_source_adapter(collector, source_id, f"{platform} connect")
        if cleanup_error:
            error = f"{error}; adapter cleanup failed: {cleanup_error}"
        await set_source_error(db, source_id, error)
        return source_id, None, error

    return source_id, result, None

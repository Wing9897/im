"""Telegram connect / background busy-retry helpers shared by ``TelegramAdapter``."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import TypeVar

from server.db.sqlite_busy import is_sqlite_busy

logger = logging.getLogger(__name__)

TELETHON_CONNECT_RETRIES = 8
TELETHON_CONNECT_DELAYS_S = (0.25, 0.5, 1.0, 2.0, 4.0, 4.0, 4.0, 4.0)
BACKGROUND_RETRIES = 6
BACKGROUND_DELAYS_S = (0.5, 1.0, 2.0, 4.0, 8.0, 8.0)

T = TypeVar("T")


async def run_with_sqlite_busy_retry(
    *,
    label: str,
    source_id: str,
    action: Callable[[], Awaitable[T]],
    retries: int = BACKGROUND_RETRIES,
    delays_s: tuple[float, ...] = BACKGROUND_DELAYS_S,
) -> T:
    """Retry ``action`` when SQLite reports busy/locked; re-raise other errors."""
    last_exc: BaseException | None = None
    for attempt in range(retries):
        try:
            return await action()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            last_exc = exc
            if not is_sqlite_busy(exc) or attempt >= retries - 1:
                raise
            delay = delays_s[min(attempt, len(delays_s) - 1)]
            logger.info(
                "Database locked during Telegram %s for source %s; retrying in %.1fs (attempt %d/%d)",
                label,
                source_id,
                delay,
                attempt + 1,
                retries,
            )
            await asyncio.sleep(delay)
    assert last_exc is not None
    raise last_exc


async def connect_telethon_with_retry(
    *,
    source_id: str,
    create_client: Callable[[], object],
    disconnect: Callable[[], Awaitable[None]],
    retries: int = TELETHON_CONNECT_RETRIES,
    delays_s: tuple[float, ...] = TELETHON_CONNECT_DELAYS_S,
) -> object:
    """Create + connect a Telethon client, retrying SQLite busy on the session file."""
    last_exc: BaseException | None = None
    for attempt in range(retries):
        client: object | None = None
        try:
            client = create_client()
            await client.connect()  # type: ignore[attr-defined]
            return client
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            last_exc = exc
            if client is not None:
                try:
                    result = client.disconnect()  # type: ignore[attr-defined]
                    if result is not None:
                        await result
                except Exception:  # noqa: BLE001 — best-effort cleanup before retry
                    logger.debug("Telegram client cleanup after failed connect ignored", exc_info=True)
            await disconnect()
            if not is_sqlite_busy(exc) or attempt >= retries - 1:
                raise
            delay = delays_s[min(attempt, len(delays_s) - 1)]
            logger.info(
                "Telegram session busy for source %s; retrying connect in %.1fs (attempt %d/%d)",
                source_id,
                delay,
                attempt + 1,
                retries,
            )
            await asyncio.sleep(delay)
    assert last_exc is not None
    raise last_exc

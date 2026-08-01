"""Base platform adapter: shared insertion, status broadcast, and reconnect.

Message insertion targets the v3 ``messages`` schema (account_id,
platform_message_id, sender_id, raw_data, created_at) with dedup via the
``(platform, platform_id, platform_message_id)`` unique index, and publishes a
``messages_updated`` SSE event carrying the full camelCase ``Message`` object
the frontend monitor page renders.
"""

from __future__ import annotations

import asyncio
import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone

from server.account_status import update_account_status
from server.collector.backoff import BASE_DELAY_SECONDS, MAX_DELAY_SECONDS, next_delay
from server.db.database import Database
from server.ingestion import insert_message
from server.sse import SseBroadcaster
from server.util import new_id

logger = logging.getLogger(__name__)


@dataclass
class AdapterState:
    """Runtime state for a platform adapter instance."""

    account_id: str
    platform: str
    status: str  # "connected" | "disconnected" | "error" | "connecting"
    retry_count: int = 0
    last_error: str | None = None
    connected_since: datetime | None = None


@dataclass
class AdapterStatus:
    """Per-adapter snapshot for the collector status endpoint."""

    name: str
    account_id: str
    connected: bool
    last_error: str | None
    last_connected_at: str | None


class BasePlatformAdapter(ABC):
    """Abstract base for all platform adapters."""

    def __init__(self, account_id: str, db: Database, broadcaster: SseBroadcaster) -> None:
        self._account_id = account_id
        self._db = db
        self._broadcaster = broadcaster
        self._state = AdapterState(
            account_id=account_id,
            platform=self._platform_name(),
            status="disconnected",
        )

    @property
    def state(self) -> AdapterState:
        return self._state

    # ── state + broadcast helpers ───────────────────────────────────────

    def _mark_connected(self) -> None:
        self._state.status = "connected"
        self._state.retry_count = 0
        self._state.last_error = None
        self._state.connected_since = datetime.now(timezone.utc)

    def _broadcast_status_change(self, status: str, last_error: str | None = None) -> None:
        """Publish per-account connection changes.

        Aggregate collector status (running/stopped/error) is published by
        ``CollectorManager`` so ``collector_status_changed`` stays consistent.
        """
        account_payload: dict = {"accountId": self._account_id, "status": status}
        if last_error is not None:
            account_payload["lastError"] = last_error
        self._broadcaster.publish("account_status_changed", account_payload)

    @abstractmethod
    async def connect(self) -> None: ...

    @abstractmethod
    async def disconnect(self) -> None: ...

    @abstractmethod
    async def is_connected(self) -> bool: ...

    def _platform_name(self) -> str:
        return "unknown"

    # ── message insertion (v3 schema) ───────────────────────────────────

    async def _insert_message(
        self,
        *,
        platform: str,
        platform_id: str,
        content: str,
        message_time: str,
        sender_name: str | None = None,
        sender_id: str | None = None,
        platform_message_id: str | None = None,
        raw_data: str | None = None,
        channel_name: str = "",
    ) -> None:
        """Insert one message (dedup-aware) and emit ``messages_updated``.

        The channel row is upserted first to satisfy the composite foreign
        key. Duplicate platform messages (same unique triple) are ignored
        silently and produce no SSE event.
        """
        message = await insert_message(
            self._db,
            message_id=new_id(),
            account_id=self._account_id,
            platform=platform,
            platform_id=platform_id,
            content=content,
            timestamp=message_time,
            sender_id=sender_id,
            sender_name=sender_name,
            platform_message_id=platform_message_id,
            raw_data=raw_data,
            channel_name=channel_name,
        )
        if message is None:
            return  # duplicate
        self._broadcaster.publish("messages_updated", {"messages": [message]})

    # ── reconnection ────────────────────────────────────────────────────

    async def _account_disabled(self) -> bool:
        """True when the account row is gone or explicitly disconnected."""
        try:
            row = await self._db.fetch_one("SELECT status FROM accounts WHERE id = ?", (self._account_id,))
        except Exception:  # noqa: BLE001 — a read error must not abort retries
            return False
        if row is None:
            return True
        return row.get("status") == "disconnected"

    async def _reconnect_loop(
        self,
        base_delay: float = BASE_DELAY_SECONDS,
        max_delay: float = MAX_DELAY_SECONDS,
    ) -> bool:
        """Reconnect with exponential backoff (1s → 60s cap, no retry cap)."""
        self._state.status = "connecting"
        self._state.retry_count = 0
        self._broadcast_status_change("connecting", self._state.last_error)

        delay: float | None = None
        while True:
            if await self._account_disabled():
                self._state.status = "disconnected"
                logger.info(
                    "Account %s disabled during reconnect; stopping retries",
                    self._account_id,
                )
                self._broadcast_status_change("disconnected", self._state.last_error)
                return False

            delay = next_delay(delay, base=base_delay, cap=max_delay)
            logger.info(
                "Reconnect attempt %d for account %s (delay=%.1fs)",
                self._state.retry_count + 1,
                self._account_id,
                delay,
            )
            await asyncio.sleep(delay)

            try:
                await self.connect()
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 — tolerate any connect failure
                self._state.retry_count += 1
                self._state.last_error = str(exc)
                logger.warning(
                    "Reconnect attempt %d failed for account %s: %s",
                    self._state.retry_count,
                    self._account_id,
                    exc,
                )
                continue

            self._mark_connected()
            await self._update_account_status("connected")
            self._broadcast_status_change("connected")
            logger.info("Reconnected account %s", self._account_id)
            return True

    async def _update_account_status(self, status: str, last_error: str | None = None) -> None:
        """Best-effort persist of the account status (and optional error)."""
        try:
            await update_account_status(self._db, self._account_id, status, last_error=last_error)
        except Exception as exc:  # noqa: BLE001 — status persistence is best-effort
            logger.warning(
                "Failed to persist account %s status=%s: %s",
                self._account_id,
                status,
                exc,
            )

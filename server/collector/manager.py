"""Collector lifecycle manager.

Owns all platform adapter instances: startup auto-reconnect of stored
``connected`` sources, graceful shutdown, restart, and the interactive
source creation flows the sources routes call into. The Telegram
interactive login steps live in ``server/collector/telegram_login.py``.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable

from server.collector import telegram_login
from server.collector.adapter_factory import build_adapter
from server.collector.base import AdapterStatus, BasePlatformAdapter
from server.collector.manager_retry import CollectorRetryOrchestrator
from server.db.database import Database
from server.paths import ensure_sessions_dir
from server.secrets import unprotect_text
from server.sse import SseBroadcaster
from server.time_iso import to_iso_z
from server.util import new_id, parse_json_dict

logger = logging.getLogger(__name__)


class CollectorManager:
    """Public façade for adapter registry, status, lifecycle, and delegates."""

    def __init__(self, db: Database, broadcaster: SseBroadcaster) -> None:
        self._db = db
        self._broadcaster = broadcaster
        self._adapters: dict[str, BasePlatformAdapter] = {}
        self._sources: list[dict] = []
        self._retry_orchestrator = CollectorRetryOrchestrator(
            db,
            broadcaster,
            self._adapters,
            self._default_session_dir,
            self._publish_aggregate_collector_status,
        )

    # ── telegram_login.AdapterRegistry protocol ─────────────────────────

    @property
    def adapters(self) -> dict[str, BasePlatformAdapter]:
        return self._adapters

    @property
    def db(self) -> Database:
        return self._db

    @property
    def broadcaster(self) -> SseBroadcaster:
        return self._broadcaster

    def session_dir(self) -> str:
        return self._default_session_dir()

    @classmethod
    async def create(cls, db: Database, broadcaster: SseBroadcaster) -> CollectorManager:
        """Load stored sources; connect adapters in the background."""
        manager = cls(db, broadcaster)
        await manager._load_connected_sources()
        await manager._retry_orchestrator.start_background(manager._sources)
        return manager

    async def shutdown(self) -> None:
        """Drain retry work, then disconnect all adapters within 10 seconds."""
        await self._retry_orchestrator.shutdown()
        if not self._adapters:
            return
        logger.info("Shutting down %d adapter(s)...", len(self._adapters))

        async def _disconnect_all() -> None:
            await asyncio.gather(
                *(self._safe_disconnect(source_id, adapter) for source_id, adapter in self._adapters.items()),
                return_exceptions=True,
            )

        try:
            await asyncio.wait_for(_disconnect_all(), timeout=10.0)
        except TimeoutError:
            logger.warning("Collector shutdown timed out after 10 seconds")
        self._adapters.clear()
        self._broadcaster.publish("collector_status_changed", {"status": "stopped"})

    async def start(self) -> None:
        """(Re)connect adapters from the current database state."""
        self._retry_orchestrator.resume()
        await self._load_connected_sources()
        await self._retry_orchestrator.auto_connect(self._sources)
        logger.info("Collector started, %d adapter(s) active", len(self._adapters))

    async def restart(self) -> None:
        logger.info("Restarting collector...")
        await self.shutdown()
        await self.start()

    # ── status ──────────────────────────────────────────────────────────

    async def get_status(self) -> str:
        """Overall status: stopped | error | running.

        Partial adapter failures do not downgrade the aggregate to ``error`` when
        at least one adapter is connected — avoids coupling AI/analysis restarts
        with a single flaky RSS source.
        """
        if not self._adapters:
            return "stopped"
        has_connected = False
        has_error = False
        for adapter in self._adapters.values():
            status = adapter.state.status
            if status == "connected":
                has_connected = True
            elif status == "error":
                has_error = True
        if has_connected:
            return "running"
        if has_error:
            return "error"
        return "stopped"

    async def _publish_aggregate_collector_status(
        self,
        *,
        adapter_name: str | None = None,
        error_summary: str | None = None,
    ) -> None:
        """Broadcast aggregate collector status on ``collector_status_changed``."""
        if self._retry_orchestrator.shutting_down:
            return
        payload: dict[str, str] = {"status": await self.get_status()}
        if adapter_name is not None:
            payload["adapter_name"] = adapter_name
        if error_summary is not None:
            payload["error_summary"] = error_summary
            payload["correlation_id"] = new_id()
        self._broadcaster.publish("collector_status_changed", payload)

    def get_adapter_statuses(self) -> list[AdapterStatus]:
        statuses: list[AdapterStatus] = []
        for adapter in self._adapters.values():
            state = adapter.state
            last_connected_at: str | None = None
            if state.connected_since is not None:
                last_connected_at = to_iso_z(state.connected_since)
            statuses.append(
                AdapterStatus(
                    name=state.platform,
                    source_id=state.source_id,
                    connected=state.status == "connected",
                    last_error=state.last_error,
                    last_connected_at=last_connected_at,
                )
            )
        return statuses

    # ── per-adapter operations ──────────────────────────────────────────

    async def stop_adapter(self, source_id: str) -> None:
        adapter = self._adapters.get(source_id)
        if adapter is None:
            return
        logger.info("Stopping adapter for source %s", source_id)
        await adapter.disconnect()
        if self._adapters.get(source_id) is adapter:
            del self._adapters[source_id]

    async def reconnect_source(self, source_id: str) -> dict:
        """Reconnect an source; builds the adapter from stored credentials if needed."""
        adapter = self._adapters.get(source_id)
        if adapter is None:
            row = await self._db.fetch_one(
                "SELECT id, platform, credentials FROM sources WHERE id = ?",
                (source_id,),
            )
            if row is None:
                raise KeyError(f"No source {source_id}")
            creds = parse_json_dict(unprotect_text(row["credentials"]))
            adapter = build_adapter(
                source_id,
                str(row["platform"]),
                creds,
                db=self._db,
                broadcaster=self._broadcaster,
                session_dir=self._default_session_dir(),
            )
            if adapter is None:
                return {"source_id": source_id, "connected": False, "status": "error"}
            self._adapters[source_id] = adapter

        logger.info("Attempting reconnect for source %s", source_id)
        try:
            await adapter.connect()
            success = True
        except Exception as exc:  # noqa: BLE001 — surface as status, not a crash
            logger.warning("Direct reconnect failed for %s: %s", source_id, exc)
            adapter.state.last_error = str(exc)
            adapter.state.status = "error"
            success = False
        return {
            "source_id": source_id,
            "connected": success,
            "status": adapter.state.status,
        }

    async def check_connection(self, source_id: str) -> dict:
        adapter = self._adapters.get(source_id)
        if adapter is None:
            raise KeyError(f"No active adapter for source {source_id}")
        connected = await adapter.is_connected()
        return {
            "source_id": source_id,
            "connected": connected,
            "status": adapter.state.status if not connected else "connected",
        }

    # ── interactive source flows (Telegram login / Discord / RSS / MQTT / Email) ─

    async def start_telegram_login(self, source_id: str, api_id: int, api_hash: str, phone: str) -> dict:
        return await telegram_login.start_telegram_login(self, source_id, api_id, api_hash, phone)

    async def start_telegram_qr_login(self, source_id: str, api_id: int, api_hash: str) -> dict:
        return await telegram_login.start_telegram_qr_login(self, source_id, api_id, api_hash)

    async def wait_telegram_qr_login(self, source_id: str, timeout: float | None = None) -> dict:
        return await telegram_login.wait_telegram_qr_login(self, source_id, timeout)

    async def verify_telegram_code(self, source_id: str, code: str, phone_code_hash: str | None) -> dict:
        return await telegram_login.verify_telegram_code(self, source_id, code, phone_code_hash)

    async def verify_telegram_2fa(self, source_id: str, password: str, phone_code_hash: str | None = None) -> dict:
        return await telegram_login.verify_telegram_2fa(self, source_id, password)

    async def _build_and_connect(self, source_id: str, platform: str, creds: dict) -> BasePlatformAdapter:
        """Factory-build, connect, and register an adapter with compensation."""
        adapter = build_adapter(
            source_id,
            platform,
            creds,
            db=self._db,
            broadcaster=self._broadcaster,
            session_dir=self._default_session_dir(),
        )
        if adapter is None:
            raise ValueError(f"Cannot build {platform} adapter for source {source_id}")
        try:
            await adapter.connect()
            registered = self._adapters.get(source_id)
            if registered is not None and registered is not adapter:
                raise RuntimeError(f"Adapter for source {source_id} was replaced concurrently")
            self._adapters[source_id] = adapter
        except BaseException:
            try:
                await adapter.disconnect()
            except Exception:  # noqa: BLE001 — preserve the build/connect failure
                logger.exception("Failed to clean up new adapter for source %s", source_id)
            if self._adapters.get(source_id) is adapter:
                del self._adapters[source_id]
            raise
        return adapter

    async def _replace_adapter(
        self,
        source_id: str,
        build_fn: Callable[[], Awaitable[dict]],
    ) -> dict:
        """Tear down an existing adapter, then run *build_fn* to recreate it."""
        adapter = self._adapters.get(source_id)
        if adapter is not None:
            await adapter.disconnect()
            if self._adapters.get(source_id) is not adapter:
                raise RuntimeError(f"Adapter for source {source_id} was replaced concurrently")
            del self._adapters[source_id]
        return await build_fn()

    # ── internal helpers ────────────────────────────────────────────────
    async def _load_connected_sources(self) -> None:
        rows = await self._db.fetch_all(
            "SELECT id, name, platform, status, credentials FROM sources WHERE status = 'connected'"
        )
        self._sources = []
        for row in rows:
            creds = parse_json_dict(unprotect_text(row["credentials"]))
            self._sources.append(
                {
                    "id": row["id"],
                    "name": row["name"],
                    "platform": row["platform"],
                    "credentials": creds,
                }
            )
        logger.info("Loaded %d connected source(s) from database", len(self._sources))

    @staticmethod
    def _default_session_dir() -> str:
        # Unified {DATA_DIR}/sessions (Desktop userData / CLI product data root).
        return str(ensure_sessions_dir())

    async def _safe_disconnect(self, source_id: str, adapter: BasePlatformAdapter) -> None:
        try:
            await adapter.disconnect()
        except Exception:  # noqa: BLE001 — shutdown must not raise
            logger.exception("Error disconnecting adapter %s", source_id)

"""Internal owner for collector auto-connect and deferred retry work."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable, Sequence
from typing import Any

from server.account_status import set_account_error
from server.collector.adapter_factory import build_adapter
from server.collector.base import BasePlatformAdapter
from server.constants import STARTUP_DB_SETTLE_SECONDS
from server.db.database import Database
from server.db.sqlite_busy import is_sqlite_busy
from server.sse import SseBroadcaster

logger = logging.getLogger(__name__)

_AUTO_CONNECT_LOCK_RETRIES = 6
_AUTO_CONNECT_LOCK_DELAYS_S = (0.5, 1.0, 2.0, 4.0, 8.0, 8.0)
_FAILED_ADAPTER_RETRY_DELAY_S = 30.0

AccountRecord = dict[str, Any]
StatusPublisher = Callable[..., Awaitable[None]]
SessionDirectory = Callable[[], str]


class CollectorRetryOrchestrator:
    """Own auto-connect/retry policy and drain every task before shutdown."""

    def __init__(
        self,
        db: Database,
        broadcaster: SseBroadcaster,
        adapters: dict[str, BasePlatformAdapter],
        session_dir: SessionDirectory,
        publish_status: StatusPublisher,
    ) -> None:
        self._db = db
        self._broadcaster = broadcaster
        self._adapters = adapters
        self._session_dir = session_dir
        self._publish_status = publish_status
        self._auto_connect_task: asyncio.Task[None] | None = None
        self._retry_tasks: dict[str, asyncio.Task[None]] = {}
        self._shutting_down = False

    @property
    def shutting_down(self) -> bool:
        return self._shutting_down

    @property
    def active_task_count(self) -> int:
        tasks = [self._auto_connect_task, *self._retry_tasks.values()]
        return sum(task is not None and not task.done() for task in tasks)

    def resume(self) -> None:
        self._shutting_down = False

    async def start_background(self, accounts: Sequence[AccountRecord]) -> None:
        """Start delayed auto-connect without blocking application startup.

        Empty-account installs skip the settle sleep and background task so
        first-run Desktop reaches ready sooner; adding an account later uses
        ``start()`` / interactive connect paths.
        """
        self.resume()
        if not accounts:
            logger.info("No connected accounts; deferring collector auto-connect")
            return

        async def _connect_in_background() -> None:
            await asyncio.sleep(STARTUP_DB_SETTLE_SECONDS)
            try:
                await self.auto_connect(accounts)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 — collector must not block startup
                logger.warning("Background auto-connect failed: %s", exc)

        self._auto_connect_task = asyncio.create_task(_connect_in_background())

    async def shutdown(self) -> None:
        """Prevent new work, cancel all owned tasks, and observe their outcomes."""
        self._shutting_down = True
        auto_connect = self._auto_connect_task
        retries = list(self._retry_tasks.items())
        tasks = [task for task in [auto_connect, *(task for _, task in retries)] if task is not None]
        for task in tasks:
            if not task.done():
                task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        if self._auto_connect_task is auto_connect:
            self._auto_connect_task = None
        for account_id, task in retries:
            self._remove_retry(account_id, task)

    async def _safe_disconnect(self, account_id: str, adapter: BasePlatformAdapter) -> None:
        try:
            await adapter.disconnect()
        except Exception as exc:  # noqa: BLE001 — retry cleanup must continue
            logger.error("Error disconnecting adapter %s: %s", account_id, exc)

    async def _connect_with_db_lock_retry(self, adapter: BasePlatformAdapter) -> None:
        for attempt in range(_AUTO_CONNECT_LOCK_RETRIES):
            try:
                await adapter.connect()
                return
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                is_last = attempt >= _AUTO_CONNECT_LOCK_RETRIES - 1
                if not is_sqlite_busy(exc) or is_last:
                    raise
                await self._safe_disconnect(adapter.state.account_id, adapter)
                delay = _AUTO_CONNECT_LOCK_DELAYS_S[attempt]
                logger.info(
                    "Database locked during auto-connect; retrying in %.1fs (attempt %d/%d)",
                    delay,
                    attempt + 1,
                    _AUTO_CONNECT_LOCK_RETRIES,
                )
                await asyncio.sleep(delay)

    def _remove_retry(self, account_id: str, completed_task: asyncio.Task[None]) -> None:
        if self._retry_tasks.get(account_id) is completed_task:
            del self._retry_tasks[account_id]

    def schedule_retry(self, account: AccountRecord) -> None:
        if self._shutting_down:
            return
        account_id = str(account["id"])
        existing = self._retry_tasks.get(account_id)
        if existing is not None and not existing.done():
            return
        task = asyncio.create_task(self._retry_later(account))
        self._retry_tasks[account_id] = task
        task.add_done_callback(lambda completed: self._remove_retry(account_id, completed))

    async def _retry_later(self, account: AccountRecord) -> None:
        await asyncio.sleep(_FAILED_ADAPTER_RETRY_DELAY_S)
        if self._shutting_down:
            return
        account_id = str(account["id"])
        adapter = self._adapters.get(account_id)
        if adapter is None or adapter.state.status != "error":
            return
        platform = str(account["platform"])
        logger.info("Retrying failed adapter for account %s (platform=%s)", account_id, platform)
        self._adapters.pop(account_id, None)
        rebuilt: BasePlatformAdapter | None = None
        try:
            rebuilt = build_adapter(
                account_id,
                platform,
                account.get("credentials") or {},
                db=self._db,
                broadcaster=self._broadcaster,
                session_dir=self._session_dir(),
            )
            if rebuilt is None:
                return
            await self._connect_with_db_lock_retry(rebuilt)
            self._adapters[account_id] = rebuilt
            logger.info("Deferred retry connected adapter for account %s (platform=%s)", account_id, platform)
            await self._publish_status()
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001 — one retry must not stop others
            logger.warning("Deferred retry failed for account %s (platform=%s): %s", account_id, platform, exc)
            if rebuilt is not None:
                rebuilt.state.status = "error"
                rebuilt.state.last_error = str(exc)
                self._adapters[account_id] = rebuilt
            if not is_sqlite_busy(exc):
                await self._publish_status(adapter_name=platform, error_summary=str(exc))

    async def auto_connect(self, accounts: Sequence[AccountRecord]) -> None:
        for account in accounts:
            if self._shutting_down:
                return
            account_id = str(account["id"])
            platform = str(account["platform"])
            adapter: BasePlatformAdapter | None = None
            try:
                adapter = build_adapter(
                    account_id,
                    platform,
                    account.get("credentials") or {},
                    db=self._db,
                    broadcaster=self._broadcaster,
                    session_dir=self._session_dir(),
                )
                if adapter is None:
                    logger.warning("No adapter for platform '%s' (account %s); skipping", platform, account_id)
                    continue
                await self._connect_with_db_lock_retry(adapter)
                self._adapters[account_id] = adapter
                logger.info("Auto-connected adapter for account %s (platform=%s)", account_id, platform)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 — one failure must not stop others
                logger.warning("Failed to auto-connect account %s (platform=%s): %s", account_id, platform, exc)
                if adapter is not None:
                    adapter.state.status = "error"
                    adapter.state.last_error = str(exc)
                    self._adapters[account_id] = adapter
                if is_sqlite_busy(exc):
                    self.schedule_retry(account)
                else:
                    # Keep DB/UI in sync (sticky `connected` + missing session was lying as「已連線」).
                    try:
                        await set_account_error(self._db, account_id, str(exc))
                    except Exception:  # noqa: BLE001 — status persist must not abort auto-connect
                        logger.exception(
                            "Failed to persist auto-connect error for account %s",
                            account_id,
                        )
                    await self._publish_status(adapter_name=platform, error_summary=str(exc))

        await self._publish_status()
        logger.info("Auto-connect complete: %d/%d adapters active", len(self._adapters), len(accounts))

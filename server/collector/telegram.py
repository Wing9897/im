"""Telegram platform adapter using Telethon for real-time message reception.

Subscribed channels are read from ``account_channels`` via the composite key
``(account_id, platform, platform_id)``. Telethon is imported at module scope
but this module is only imported lazily via the factory/manager.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable

from telethon import TelegramClient, events
from telethon.tl.custom.qrlogin import QRLogin
from telethon.tl.types import Message

from server.collector import telegram_adapter_login, telegram_ingest
from server.collector.base import BasePlatformAdapter
from server.collector.telegram_media import download_telegram_media_bytes
from server.collector.telegram_retry import connect_telethon_with_retry, run_with_sqlite_busy_retry
from server.collector.telegram_session import (
    load_string_session,
)
from server.db.database import Database
from server.sse import SseBroadcaster

logger = logging.getLogger(__name__)


class TelegramAdapter(BasePlatformAdapter):
    """Connects to Telegram via Telethon and receives messages in real-time."""

    def __init__(
        self,
        account_id: str,
        db: Database,
        broadcaster: SseBroadcaster,
        api_id: int,
        api_hash: str,
        session_dir: str,
    ) -> None:
        super().__init__(account_id, db, broadcaster)
        self._api_id = api_id
        self._api_hash = api_hash
        self._session_dir = session_dir
        self._client: TelegramClient | None = None
        self._phone: str | None = None
        self._qr_login: QRLogin | None = None
        self._qr_wait_lock = asyncio.Lock()
        self._startup_task: asyncio.Task[None] | None = None
        self._message_handler: Callable[[events.NewMessage.Event], Awaitable[None]] | None = None
        self._message_event_builder: events.NewMessage | None = None

    def _platform_name(self) -> str:
        return "telegram"

    def _create_client(self) -> TelegramClient:
        session = load_string_session(self._session_dir, self._account_id)
        return TelegramClient(session, self._api_id, self._api_hash)

    async def _connect_telethon_with_retry(self) -> None:
        self._client = await connect_telethon_with_retry(  # type: ignore[assignment]
            account_id=self._account_id,
            create_client=self._create_client,
            disconnect=self.disconnect,
        )

    async def connect(self) -> None:
        """Connect an already-authorized Telethon session; hydrate DB later."""
        await self.disconnect()
        self._state.status = "connecting"
        try:
            await self._connect_telethon_with_retry()
            if self._client is None or not await self._client.is_user_authorized():
                raise RuntimeError("Telegram session is not authorized; complete the interactive login flow first")
        except BaseException as exc:
            try:
                await self.disconnect()
            except Exception:  # noqa: BLE001 — preserve the connect/cancellation failure
                logger.exception("Failed to clean up Telegram client for account %s", self._account_id)
            self._state.status = "disconnected"
            if isinstance(exc, Exception):
                self._state.last_error = str(exc)
            raise
        self._mark_connected()
        logger.info("Telegram adapter connected for account %s", self._account_id)
        self._startup_task = asyncio.create_task(self._finish_startup())

    async def disconnect(self) -> None:
        if self._startup_task is not None:
            self._startup_task.cancel()
            try:
                await self._startup_task
            except asyncio.CancelledError:
                pass
            self._startup_task = None

        self._qr_login = None
        if self._client is not None:
            self._clear_message_handlers()
            result = self._client.disconnect()
            if result is not None:
                await result
            self._client = None
            logger.info("Telegram adapter disconnected for account %s", self._account_id)

    async def is_connected(self) -> bool:
        return self._client is not None and bool(self._client.is_connected())

    # ── login flow ──────────────────────────────────────────────────────

    async def start_login(self, api_id: int, api_hash: str, phone: str) -> dict:
        """Initiate phone login and send a code request."""
        return await telegram_adapter_login.start_login(self, api_id, api_hash, phone)

    async def verify_code(self, code: str, phone_code_hash: str | None) -> dict:
        """Submit the verification code; may escalate to 2FA."""
        return await telegram_adapter_login.verify_code(self, code, phone_code_hash)

    async def verify_2fa(self, password: str) -> dict:
        """Submit the 2FA password to complete authentication."""
        return await telegram_adapter_login.verify_2fa(self, password)

    async def start_qr_login(self, api_id: int, api_hash: str) -> dict:
        """Start Telegram QR login and return the ``tg://login`` URL to display."""
        return await telegram_adapter_login.start_qr_login(self, api_id, api_hash)

    async def wait_qr_login(self, timeout: float | None = None) -> dict:
        """Long-poll until QR is scanned, expires (recreate), needs 2FA, or times out."""
        return await telegram_adapter_login.wait_qr_login(self, timeout)

    def _qr_expires_in_seconds(self) -> float:
        return telegram_adapter_login.qr_expires_in_seconds(self)

    def _qr_login_payload(self) -> dict:
        return telegram_adapter_login.qr_login_payload(self)

    async def sync_dialog_channels(self) -> int:
        """Persist joined Telegram groups/channels from ``iter_dialogs()``."""
        return await telegram_ingest.sync_dialog_channels(self)

    async def _run_with_busy_retry(self, label: str, action) -> None:
        await run_with_sqlite_busy_retry(
            label=label,
            account_id=self._account_id,
            action=action,
        )

    async def _finish_startup(self) -> None:
        await asyncio.sleep(2)
        try:
            if self._client is not None and await self._client.is_user_authorized():
                await self._run_with_busy_retry("dialog sync", self.sync_dialog_channels)
            await self._run_with_busy_retry("handler registration", self._register_message_handlers)
            self._persist_string_session()
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning(
                "Deferred Telegram startup work failed for account %s: %s",
                self._account_id,
                exc,
            )

    def _persist_string_session(self) -> None:
        """Persist Telethon StringSession; raise if the token file cannot be written."""
        telegram_adapter_login.persist_string_session(self)

    # ── internal helpers ────────────────────────────────────────────────

    def _clear_message_handlers(self) -> None:
        if self._client is not None and self._message_handler is not None and self._message_event_builder is not None:
            self._client.remove_event_handler(self._message_handler, self._message_event_builder)
        self._message_handler = None
        self._message_event_builder = None

    async def _register_message_handlers(self) -> None:
        if self._client is None:
            return
        channel_ids = await self._load_subscribed_channels()
        if not channel_ids:
            logger.info(
                "Telegram account %s has no subscribed channels; message collection is disabled",
                self._account_id,
            )
            self._clear_message_handlers()
            return

        self._clear_message_handlers()

        async def _message_handler(event: events.NewMessage.Event) -> None:
            await self._handle_message(event)

        builder = events.NewMessage(chats=channel_ids)
        self._client.add_event_handler(_message_handler, builder)
        self._message_handler = _message_handler
        self._message_event_builder = builder

    async def _on_login_success(self) -> None:
        """Persist session + mark connected quickly; defer dialog sync to startup task.

        QR long-poll HTTP clients historically used a 30s abort. Full dialog sync
        after scan often exceeded that and surfaced as「請求逾時」even when login
        succeeded — so heavy work runs via ``_finish_startup`` instead.
        """
        await telegram_adapter_login.on_login_success(self)

    async def _apply_logged_in_profile(self) -> None:
        """Best-effort: set display name from Telegram identity after QR/first login."""
        await telegram_adapter_login.apply_logged_in_profile(self)

    async def _load_subscribed_channels(self) -> list[int]:
        """Integer platform_ids from ``account_channels`` for Telethon's filter."""
        return await telegram_ingest.load_subscribed_channels(self)

    async def _resolve_channel_name(self, event: events.NewMessage.Event) -> str:
        """Best-effort chat title resolution; never breaks collection."""
        return await telegram_ingest.resolve_channel_name(self, event)

    async def _handle_message(self, event: events.NewMessage.Event) -> None:
        """Extract fields from an incoming message and insert it."""
        await telegram_ingest.handle_message(self, event)

    async def fetch_media_bytes(self, platform_id: str, platform_message_id: str) -> tuple[bytes, str]:
        """Re-fetch a message by id and download its media into memory."""
        if self._client is None:
            raise RuntimeError("Telegram client not connected")
        message = await self._client.get_messages(
            int(platform_id),
            ids=int(platform_message_id),
        )
        if not isinstance(message, Message):
            raise KeyError(f"Telegram message {platform_message_id} not found in {platform_id}")
        return await download_telegram_media_bytes(self._client, message)

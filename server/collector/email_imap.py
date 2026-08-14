"""IMAP email platform adapter (imap-tools polling with UID cursors).

Mailbox open/verify/fetch: ``email_imap_mailbox``. Poll cycle / cursor
persist: ``email_imap_poll``. Fetch/parse helpers: ``email_imap_fetch``.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Callable
from contextlib import suppress
from typing import Any

from server.collector.base import BasePlatformAdapter
from server.collector.email_config import (
    DEFAULT_FOLDERS,
    DEFAULT_INITIAL_SYNC_DAYS,
    DEFAULT_INITIAL_SYNC_MAX,
    DEFAULT_POLL_INTERVAL,
    clamp_initial_sync_days,
    clamp_initial_sync_max_messages,
    clamp_poll_interval,
    default_imap_port,
    email_channel_platform_id,
    format_imap_error,
)
from server.collector.email_imap_fetch import (
    FetchedEmail,
    FolderPollResult,
    fetch_folder,
    parse_imap_message,
    sender_allowed,
)
from server.collector.email_imap_mailbox import (
    fetch_all_folders,
    mark_uids_seen,
    open_mailbox,
    verify_login_and_folders,
)
from server.collector.email_imap_poll import persist_folder_state, poll_once
from server.db.database import Database
from server.outbound import validate_imap_host
from server.sse import SseBroadcaster

logger = logging.getLogger(__name__)

__all__ = [
    "EmailImapAdapter",
    "FetchedEmail",
    "FolderPollResult",
]

_IMAP_DRAIN_TIMEOUT_SECONDS = 6


class EmailImapAdapter(BasePlatformAdapter):
    """Polls IMAP folders and inserts new messages with UID-based dedup."""

    def __init__(
        self,
        source_id: str,
        db: Database,
        broadcaster: SseBroadcaster,
        *,
        imap_host: str,
        imap_port: int,
        username: str,
        password: str,
        use_ssl: bool = True,
        folders: list[str] | None = None,
        poll_interval_seconds: int = DEFAULT_POLL_INTERVAL,
        initial_sync_days: int = DEFAULT_INITIAL_SYNC_DAYS,
        initial_sync_max_messages: int = DEFAULT_INITIAL_SYNC_MAX,
        sender_allowlist: list[str] | None = None,
        mark_as_read: bool = False,
        folder_cursors: dict[str, int] | None = None,
        folder_uidvalidities: dict[str, int] | None = None,
    ) -> None:
        super().__init__(source_id, db, broadcaster)
        self._imap_host = imap_host
        self._imap_port = int(imap_port or default_imap_port(use_ssl=use_ssl))
        self._username = username
        self._password = password
        self._use_ssl = bool(use_ssl)
        self._folders = folders if folders else list(DEFAULT_FOLDERS)
        self._poll_interval: float = clamp_poll_interval(poll_interval_seconds)
        self._initial_sync_days = clamp_initial_sync_days(initial_sync_days)
        self._initial_sync_max = clamp_initial_sync_max_messages(initial_sync_max_messages)
        self._sender_allowlist = sender_allowlist or []
        self._mark_as_read = bool(mark_as_read)
        self._folder_cursors: dict[str, int] = {str(k): int(v) for k, v in (folder_cursors or {}).items()}
        self._folder_uidvalidities: dict[str, int] = {str(k): int(v) for k, v in (folder_uidvalidities or {}).items()}
        self._blocking_tasks: set[asyncio.Task[Any]] = set()
        self._poll_task: asyncio.Task | None = None
        self._poll_lock = asyncio.Lock()
        self._auth_failures = 0

    def _platform_name(self) -> str:
        return "email"

    @property
    def folders(self) -> list[str]:
        return list(self._folders)

    async def _run_blocking(self, function: Callable[..., Any], *args: Any) -> Any:
        """Run IMAP work in an owned thread task that survives caller cancellation for draining."""
        task = asyncio.create_task(asyncio.to_thread(function, *args))
        self._blocking_tasks.add(task)
        task.add_done_callback(self._blocking_tasks.discard)
        return await asyncio.shield(task)

    async def _drain_blocking_tasks(self) -> None:
        pending = [task for task in self._blocking_tasks if not task.done()]
        if not pending:
            return
        try:
            await asyncio.wait_for(
                asyncio.gather(*pending, return_exceptions=True),
                timeout=_IMAP_DRAIN_TIMEOUT_SECONDS,
            )
        except TimeoutError:
            logger.warning(
                "Timed out draining %d IMAP operation(s) for source %s",
                len(pending),
                self._source_id,
            )

    async def connect(self) -> None:
        from imap_tools.errors import MailboxLoginError

        await self.disconnect()
        self._state.status = "connecting"
        await validate_imap_host(self._imap_host, self._imap_port, use_ssl=self._use_ssl)
        try:
            await self._run_blocking(self._verify_login_and_folders)
        except MailboxLoginError as exc:
            friendly = format_imap_error(exc, host=self._imap_host, username=self._username)
            logger.warning("Email IMAP auth failed for source %s: %s", self._source_id, exc)
            raise ValueError(friendly) from exc
        self._poll_task = asyncio.create_task(self._poll_loop(), name=f"email-poll-{self._source_id}")
        self._mark_connected()
        self._broadcast_status_change("connected")
        logger.info(
            "Email IMAP adapter connected for source %s (host=%s, folders=%s)",
            self._source_id,
            self._imap_host,
            self._folders,
        )

    async def disconnect(self) -> None:
        poll_task = self._poll_task
        self._poll_task = None
        if poll_task is not None and not poll_task.done():
            poll_task.cancel()
            with suppress(asyncio.CancelledError):
                await poll_task
        await self._drain_blocking_tasks()
        self._state.status = "disconnected"
        logger.info("Email IMAP adapter disconnected for source %s", self._source_id)

    async def is_connected(self) -> bool:
        return self._poll_task is not None and not self._poll_task.done()

    async def _poll_loop(self) -> None:
        while True:
            try:
                async with self._poll_lock:
                    await self._poll_once()
                await asyncio.sleep(self._poll_interval)
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001 — one poll cycle must not kill the loop
                logger.warning("Email poll cycle failed for source %s: %s", self._source_id, exc)
                await asyncio.sleep(self._poll_interval)

    async def _poll_once(self) -> None:
        self._auth_failures = await poll_once(
            source_id=self._source_id,
            imap_host=self._imap_host,
            username=self._username,
            run_blocking=self._run_blocking,
            fetch_all_folders=self._fetch_all_folders,
            folder_cursors=self._folder_cursors,
            folder_uidvalidities=self._folder_uidvalidities,
            mark_as_read=self._mark_as_read,
            mark_uids_seen=self._mark_uids_seen,
            ingest_fetched=self._ingest_fetched,
            persist_folder_state=self._persist_folder_state,
            format_imap_error=format_imap_error,
            state=self._state,
            update_source_status=self._update_source_status,
            broadcast_status_change=self._broadcast_status_change,
            auth_failures=self._auth_failures,
        )

    def _verify_login_and_folders(self) -> None:
        verify_login_and_folders(open_mailbox_fn=self._open_mailbox, folders=self._folders)

    def _open_mailbox(self):
        return open_mailbox(
            imap_host=self._imap_host,
            imap_port=self._imap_port,
            username=self._username,
            password=self._password,
            use_ssl=self._use_ssl,
        )

    def _fetch_all_folders(
        self,
        folder_cursors: dict[str, int],
        folder_uidvalidities: dict[str, int],
    ) -> list[FolderPollResult]:
        return fetch_all_folders(
            open_mailbox_fn=self._open_mailbox,
            folders=self._folders,
            folder_cursors=folder_cursors,
            folder_uidvalidities=folder_uidvalidities,
            source_id=self._source_id,
            fetch_one=self._fetch_folder,
        )

    def _fetch_folder(
        self,
        mailbox: Any,
        folder: str,
        last_uid: int | None,
        expected_uid_validity: int | None,
    ) -> FolderPollResult:
        return fetch_folder(
            mailbox,
            folder,
            last_uid,
            expected_uid_validity,
            source_id=self._source_id,
            initial_sync_days=self._initial_sync_days,
            initial_sync_max=self._initial_sync_max,
            sender_allowlist=self._sender_allowlist,
        )

    def _sender_allowed(self, msg: Any) -> bool:
        return sender_allowed(msg, self._sender_allowlist)

    def _parse_message(self, folder: str, msg: Any) -> FetchedEmail:
        return parse_imap_message(folder, msg)

    async def _ingest_fetched(self, fetched: FetchedEmail) -> None:
        platform_id = email_channel_platform_id(
            self._imap_host,
            self._imap_port,
            self._username,
            fetched.folder,
        )
        content = (
            f"{fetched.subject}\n\n{fetched.body}".strip() if fetched.body else fetched.subject or "(empty message)"
        )
        raw_data = None
        if fetched.attachment_names:
            raw_data = json.dumps({"attachmentNames": fetched.attachment_names}, ensure_ascii=False)

        await self._insert_message(
            platform="email",
            platform_id=platform_id,
            content=content,
            message_time=fetched.message_time,
            sender_name=fetched.sender_name,
            platform_message_id=fetched.platform_message_id,
            raw_data=raw_data,
            channel_name=fetched.folder,
        )

    def _mark_uids_seen(self, folder: str, uids: list[int]) -> None:
        mark_uids_seen(open_mailbox_fn=self._open_mailbox, folder=folder, uids=uids)

    async def _persist_folder_state(
        self,
        cursor_updates: dict[str, int],
        uid_validity_updates: dict[str, int],
        cursor_resets: set[str],
    ) -> None:
        self._folder_cursors, self._folder_uidvalidities = await persist_folder_state(
            db=self._db,
            source_id=self._source_id,
            cursor_updates=cursor_updates,
            uid_validity_updates=uid_validity_updates,
            cursor_resets=cursor_resets,
            folder_cursors=self._folder_cursors,
            folder_uidvalidities=self._folder_uidvalidities,
        )

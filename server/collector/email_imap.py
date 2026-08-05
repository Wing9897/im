"""IMAP email platform adapter (imap-tools polling with UID cursors)."""

from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import Callable
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
    from_addresses,
    html_to_text,
    parse_imap_message,
    sender_allowed,
)
from server.db.database import Database
from server.outbound import validate_imap_host
from server.source_credentials import mutate_source_credentials
from server.sse import SseBroadcaster

logger = logging.getLogger(__name__)

# Re-export parse helpers for tests / callers that import from this module.
__all__ = [
    "EmailImapAdapter",
    "FetchedEmail",
    "FolderPollResult",
    "from_addresses",
    "html_to_text",
]

_MAX_AUTH_FAILURES = 3
_IMAP_IO_TIMEOUT_SECONDS = 5
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
        self._poll_interval = clamp_poll_interval(poll_interval_seconds)
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
        except asyncio.TimeoutError:
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
            try:
                await poll_task
            except asyncio.CancelledError:
                pass
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
        from imap_tools.errors import MailboxLoginError

        try:
            results = await self._run_blocking(
                self._fetch_all_folders,
                dict(self._folder_cursors),
                dict(self._folder_uidvalidities),
            )
        except MailboxLoginError as exc:
            self._auth_failures += 1
            friendly = format_imap_error(exc, host=self._imap_host, username=self._username)
            logger.warning(
                "Email IMAP auth failed for source %s (attempt %d): %s",
                self._source_id,
                self._auth_failures,
                exc,
            )
            if self._auth_failures >= _MAX_AUTH_FAILURES:
                self._state.status = "error"
                self._state.last_error = friendly
                await self._update_source_status("error", friendly)
                self._broadcast_status_change("error", friendly)
            return

        self._auth_failures = 0
        if self._state.status == "error":
            self._state.status = "connected"
            self._state.last_error = None
            await self._update_source_status("connected")
            self._broadcast_status_change("connected")

        cursor_updates: dict[str, int] = {}
        uid_validity_updates: dict[str, int] = {}
        cursor_resets: set[str] = set()
        for folder_result in results:
            for fetched in folder_result.messages:
                await self._ingest_fetched(fetched)
            uid_validity_updates[folder_result.folder] = folder_result.uid_validity
            if folder_result.cursor_reset:
                cursor_resets.add(folder_result.folder)
            if folder_result.max_uid is not None:
                cursor_updates[folder_result.folder] = folder_result.max_uid
            if self._mark_as_read and folder_result.seen_uids:
                await self._run_blocking(self._mark_uids_seen, folder_result.folder, folder_result.seen_uids)

        if cursor_updates or uid_validity_updates or cursor_resets:
            await self._persist_folder_state(cursor_updates, uid_validity_updates, cursor_resets)

    def _verify_login_and_folders(self) -> None:
        with self._open_mailbox() as mailbox:
            available = {info.name for info in mailbox.folder.list()}
            missing = [folder for folder in self._folders if folder not in available]
            if missing:
                raise ValueError(f"IMAP folder(s) not found: {', '.join(missing)}")

    def _open_mailbox(self):
        from imap_tools import MailBox, MailBoxUnencrypted

        if self._use_ssl:
            return MailBox(
                self._imap_host,
                port=self._imap_port,
                timeout=_IMAP_IO_TIMEOUT_SECONDS,
            ).login(self._username, self._password)
        return MailBoxUnencrypted(
            self._imap_host,
            port=self._imap_port,
            timeout=_IMAP_IO_TIMEOUT_SECONDS,
        ).login(self._username, self._password)

    def _fetch_all_folders(
        self,
        folder_cursors: dict[str, int],
        folder_uidvalidities: dict[str, int],
    ) -> list[FolderPollResult]:
        from imap_tools.errors import MailboxLoginError

        results: list[FolderPollResult] = []
        with self._open_mailbox() as mailbox:
            for folder in self._folders:
                try:
                    results.append(
                        self._fetch_folder(
                            mailbox,
                            folder,
                            folder_cursors.get(folder),
                            folder_uidvalidities.get(folder),
                        )
                    )
                except MailboxLoginError:
                    raise
                except Exception as exc:  # noqa: BLE001 — isolate non-auth per-folder failures
                    logger.warning(
                        "Email poll folder failed for source %s folder=%s: %s",
                        self._source_id,
                        folder,
                        exc,
                    )
        return results

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
        from imap_tools import MailMessageFlags

        with self._open_mailbox() as mailbox:
            mailbox.folder.set(folder)
            mailbox.flag([str(uid) for uid in uids], MailMessageFlags.SEEN, True)

    async def _persist_folder_state(
        self,
        cursor_updates: dict[str, int],
        uid_validity_updates: dict[str, int],
        cursor_resets: set[str],
    ) -> None:
        normalized_cursors = {str(key): int(value) for key, value in cursor_updates.items()}
        normalized_validities = {str(key): int(value) for key, value in uid_validity_updates.items()}

        def _merge(current: dict[str, Any]) -> dict[str, Any]:
            raw_cursors = current.get("folder_cursors")
            cursors = dict(raw_cursors) if isinstance(raw_cursors, dict) else {}
            for folder in cursor_resets:
                cursors.pop(folder, None)
            for folder, uid in normalized_cursors.items():
                if folder in cursor_resets:
                    cursors[folder] = uid
                else:
                    cursors[folder] = max(int(cursors.get(folder, 0)), uid)

            raw_validities = current.get("folder_uidvalidities")
            validities = dict(raw_validities) if isinstance(raw_validities, dict) else {}
            validities.update(normalized_validities)
            current["folder_cursors"] = cursors
            current["folder_uidvalidities"] = validities
            return current

        persisted = await mutate_source_credentials(self._db, self._source_id, _merge)
        if persisted is None:
            return
        raw_cursors = persisted.get("folder_cursors")
        if isinstance(raw_cursors, dict):
            self._folder_cursors = {str(key): int(value) for key, value in raw_cursors.items()}
        raw_validities = persisted.get("folder_uidvalidities")
        if isinstance(raw_validities, dict):
            self._folder_uidvalidities = {str(key): int(value) for key, value in raw_validities.items()}

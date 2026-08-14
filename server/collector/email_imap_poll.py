"""IMAP poll-cycle orchestration and folder-cursor persistence."""

from __future__ import annotations

import logging
from collections.abc import Awaitable, Callable
from typing import Any

from server.collector.email_imap_fetch import FetchedEmail, FolderPollResult
from server.db.database import Database
from server.source_credentials import mutate_source_credentials

logger = logging.getLogger(__name__)

_MAX_AUTH_FAILURES = 3


async def poll_once(
    *,
    source_id: str,
    imap_host: str,
    username: str,
    run_blocking: Callable[..., Awaitable[Any]],
    fetch_all_folders: Callable[[dict[str, int], dict[str, int]], list[FolderPollResult]],
    folder_cursors: dict[str, int],
    folder_uidvalidities: dict[str, int],
    mark_as_read: bool,
    mark_uids_seen: Callable[[str, list[int]], None],
    ingest_fetched: Callable[[FetchedEmail], Awaitable[None]],
    persist_folder_state: Callable[[dict[str, int], dict[str, int], set[str]], Awaitable[None]],
    format_imap_error: Callable[..., str],
    state: Any,
    update_source_status: Callable[..., Awaitable[None]],
    broadcast_status_change: Callable[..., None],
    auth_failures: int,
) -> int:
    """Run one poll cycle. Returns the updated auth-failure counter."""
    from imap_tools.errors import MailboxLoginError

    try:
        results = await run_blocking(
            fetch_all_folders,
            dict(folder_cursors),
            dict(folder_uidvalidities),
        )
    except MailboxLoginError as exc:
        auth_failures += 1
        friendly = format_imap_error(exc, host=imap_host, username=username)
        logger.warning(
            "Email IMAP auth failed for source %s (attempt %d): %s",
            source_id,
            auth_failures,
            exc,
        )
        if auth_failures >= _MAX_AUTH_FAILURES:
            state.status = "error"
            state.last_error = friendly
            await update_source_status("error", friendly)
            broadcast_status_change("error", friendly)
        return auth_failures

    auth_failures = 0
    if state.status == "error":
        state.status = "connected"
        state.last_error = None
        await update_source_status("connected")
        broadcast_status_change("connected")

    cursor_updates: dict[str, int] = {}
    uid_validity_updates: dict[str, int] = {}
    cursor_resets: set[str] = set()
    for folder_result in results:
        for fetched in folder_result.messages:
            await ingest_fetched(fetched)
        uid_validity_updates[folder_result.folder] = folder_result.uid_validity
        if folder_result.cursor_reset:
            cursor_resets.add(folder_result.folder)
        if folder_result.max_uid is not None:
            cursor_updates[folder_result.folder] = folder_result.max_uid
        if mark_as_read and folder_result.seen_uids:
            await run_blocking(mark_uids_seen, folder_result.folder, folder_result.seen_uids)

    if cursor_updates or uid_validity_updates or cursor_resets:
        await persist_folder_state(cursor_updates, uid_validity_updates, cursor_resets)
    return auth_failures


async def persist_folder_state(
    *,
    db: Database,
    source_id: str,
    cursor_updates: dict[str, int],
    uid_validity_updates: dict[str, int],
    cursor_resets: set[str],
    folder_cursors: dict[str, int],
    folder_uidvalidities: dict[str, int],
) -> tuple[dict[str, int], dict[str, int]]:
    """Merge cursor updates into credentials; return refreshed in-memory maps."""
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

    persisted = await mutate_source_credentials(db, source_id, _merge)
    if persisted is None:
        return folder_cursors, folder_uidvalidities
    next_cursors = folder_cursors
    next_validities = folder_uidvalidities
    raw_cursors = persisted.get("folder_cursors")
    if isinstance(raw_cursors, dict):
        next_cursors = {str(key): int(value) for key, value in raw_cursors.items()}
    raw_validities = persisted.get("folder_uidvalidities")
    if isinstance(raw_validities, dict):
        next_validities = {str(key): int(value) for key, value in raw_validities.items()}
    return next_cursors, next_validities

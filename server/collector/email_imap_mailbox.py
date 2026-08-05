"""IMAP mailbox open / verify / multi-folder fetch helpers."""

from __future__ import annotations

import logging
from typing import Any, Callable

from server.collector.email_imap_fetch import FolderPollResult

logger = logging.getLogger(__name__)

_IMAP_IO_TIMEOUT_SECONDS = 5


def open_mailbox(
    *,
    imap_host: str,
    imap_port: int,
    username: str,
    password: str,
    use_ssl: bool,
) -> Any:
    from imap_tools import MailBox, MailBoxUnencrypted

    if use_ssl:
        return MailBox(
            imap_host,
            port=imap_port,
            timeout=_IMAP_IO_TIMEOUT_SECONDS,
        ).login(username, password)
    return MailBoxUnencrypted(
        imap_host,
        port=imap_port,
        timeout=_IMAP_IO_TIMEOUT_SECONDS,
    ).login(username, password)


def verify_login_and_folders(
    *,
    open_mailbox_fn: Callable[[], Any],
    folders: list[str],
) -> None:
    with open_mailbox_fn() as mailbox:
        available = {info.name for info in mailbox.folder.list()}
        missing = [folder for folder in folders if folder not in available]
        if missing:
            raise ValueError(f"IMAP folder(s) not found: {', '.join(missing)}")


def fetch_all_folders(
    *,
    open_mailbox_fn: Callable[[], Any],
    folders: list[str],
    folder_cursors: dict[str, int],
    folder_uidvalidities: dict[str, int],
    source_id: str,
    fetch_one: Callable[[Any, str, int | None, int | None], FolderPollResult],
) -> list[FolderPollResult]:
    from imap_tools.errors import MailboxLoginError

    results: list[FolderPollResult] = []
    with open_mailbox_fn() as mailbox:
        for folder in folders:
            try:
                results.append(
                    fetch_one(
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
                    source_id,
                    folder,
                    exc,
                )
    return results


def mark_uids_seen(
    *,
    open_mailbox_fn: Callable[[], Any],
    folder: str,
    uids: list[int],
) -> None:
    from imap_tools import MailMessageFlags

    with open_mailbox_fn() as mailbox:
        mailbox.folder.set(folder)
        mailbox.flag([str(uid) for uid in uids], MailMessageFlags.SEEN, True)

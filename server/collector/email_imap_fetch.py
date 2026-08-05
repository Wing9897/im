"""IMAP folder fetch + message parse helpers for EmailImapAdapter."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from html import unescape
from typing import Any

from server.time_iso import to_iso_z
from server.util import utc_now_iso

logger = logging.getLogger(__name__)

_HTML_TAG_RE = re.compile(r"<[^>]+>")
_HTML_BLOCK_RE = re.compile(r"(?is)<(script|style)[^>]*>.*?</\1>")


@dataclass
class FetchedEmail:
    folder: str
    uid: int
    subject: str
    body: str
    sender_name: str | None
    platform_message_id: str
    message_time: str
    attachment_names: list[str] = field(default_factory=list)


@dataclass
class FolderPollResult:
    folder: str
    messages: list[FetchedEmail]
    max_uid: int | None
    seen_uids: list[int]
    uid_validity: int
    cursor_reset: bool


def html_to_text(html: str) -> str:
    """Strip HTML tags to plain text without rendering."""
    if not html:
        return ""
    stripped = _HTML_BLOCK_RE.sub("", html)
    stripped = _HTML_TAG_RE.sub(" ", stripped)
    return unescape(re.sub(r"\s+", " ", stripped)).strip()


def from_addresses(msg) -> list[Any]:
    """Normalize imap_tools ``from_values`` (single EmailAddress) for iteration."""
    from_values = getattr(msg, "from_values", None)
    if not from_values:
        return []
    if isinstance(from_values, (list, tuple)):
        return list(from_values)
    return [from_values]


def sender_allowed(msg: Any, sender_allowlist: list[str]) -> bool:
    if not sender_allowlist:
        return True
    emails = {str(sender.email).lower() for sender in from_addresses(msg) if getattr(sender, "email", None)}
    for token in sender_allowlist:
        if token in emails:
            return True
        if "@" not in token and any(email.endswith(f"@{token}") for email in emails):
            return True
    return False


def parse_imap_message(folder: str, msg: Any) -> FetchedEmail:
    subject = (getattr(msg, "subject", None) or "").strip()
    body = (getattr(msg, "text", None) or "").strip()
    if not body:
        body = html_to_text(getattr(msg, "html", None) or "")

    message_id = getattr(msg, "msg_id", None) or getattr(msg, "message_id", None)
    platform_message_id = str(message_id).strip() if message_id else f"uid:{folder}:{msg.uid}"

    sender_name = None
    addresses = from_addresses(msg)
    if addresses:
        first = addresses[0]
        sender_name = getattr(first, "name", None) or getattr(first, "email", None)

    msg_date = getattr(msg, "date", None)
    if isinstance(msg_date, datetime):
        if msg_date.tzinfo is None:
            msg_date = msg_date.replace(tzinfo=timezone.utc)
        message_time = to_iso_z(msg_date)
    else:
        message_time = utc_now_iso()

    attachments = getattr(msg, "attachments", None) or []
    attachment_names = [str(getattr(att, "filename", "")) for att in attachments if getattr(att, "filename", None)]

    return FetchedEmail(
        folder=folder,
        uid=int(msg.uid),
        subject=subject,
        body=body,
        sender_name=str(sender_name) if sender_name else None,
        platform_message_id=platform_message_id,
        message_time=message_time,
        attachment_names=attachment_names,
    )


def fetch_folder(
    mailbox: Any,
    folder: str,
    last_uid: int | None,
    expected_uid_validity: int | None,
    *,
    source_id: str,
    initial_sync_days: int,
    initial_sync_max: int,
    sender_allowlist: list[str],
) -> FolderPollResult:
    from imap_tools import AND, A

    mailbox.folder.set(folder)
    status = mailbox.folder.status(folder, ["UIDVALIDITY"])
    uid_validity = int(status.get("UIDVALIDITY") or 0)
    if uid_validity <= 0:
        raise ValueError(f"IMAP folder {folder} did not report UIDVALIDITY")

    cursor_reset = last_uid is not None and expected_uid_validity != uid_validity
    if cursor_reset:
        logger.info(
            "Resetting email cursor for source %s folder=%s (UIDVALIDITY %s -> %s)",
            source_id,
            folder,
            expected_uid_validity,
            uid_validity,
        )
    effective_last_uid = None if expected_uid_validity != uid_validity else last_uid
    if effective_last_uid is None:
        since = date.today() - timedelta(days=initial_sync_days)
        raw_messages = list(
            mailbox.fetch(
                AND(date_gte=since),
                limit=initial_sync_max,
                reverse=True,
                mark_seen=False,
            )
        )
    else:
        raw_messages = list(mailbox.fetch(A(uid=f"{effective_last_uid + 1}:*"), mark_seen=False))

    if not raw_messages:
        return FolderPollResult(
            folder=folder,
            messages=[],
            max_uid=None,
            seen_uids=[],
            uid_validity=uid_validity,
            cursor_reset=cursor_reset,
        )

    max_uid = effective_last_uid or 0
    fetched: list[FetchedEmail] = []
    seen_uids: list[int] = []
    for msg in raw_messages:
        uid = int(msg.uid)
        max_uid = max(max_uid, uid)
        if not sender_allowed(msg, sender_allowlist):
            continue
        parsed = parse_imap_message(folder, msg)
        fetched.append(parsed)
        seen_uids.append(uid)

    return FolderPollResult(
        folder=folder,
        messages=fetched,
        max_uid=max_uid,
        seen_uids=seen_uids,
        uid_validity=uid_validity,
        cursor_reset=cursor_reset,
    )

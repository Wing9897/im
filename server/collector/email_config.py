"""Shared email IMAP credential normalization for API routes and collector."""

from __future__ import annotations

from typing import Any

from server.collector.poll_config import DEFAULT_POLL_INTERVAL, clamp_poll_interval
from server.secrets import MASKED_SECRET

DEFAULT_FOLDERS: tuple[str, ...] = ("INBOX",)
DEFAULT_INITIAL_SYNC_DAYS = 7
DEFAULT_INITIAL_SYNC_MAX = 100


def default_imap_port(*, use_ssl: bool) -> int:
    return 993 if use_ssl else 143


def normalize_folders(folders: Any) -> list[str]:
    if isinstance(folders, str):
        return [part.strip() for part in folders.replace("\n", ",").split(",") if part.strip()]
    if isinstance(folders, list):
        return [str(item).strip() for item in folders if str(item).strip()]
    return list(DEFAULT_FOLDERS)


def normalize_allowlist(value: Any) -> list[str]:
    if isinstance(value, str):
        return [part.strip().lower() for part in value.replace("\n", ",").split(",") if part.strip()]
    if isinstance(value, list):
        return [str(item).strip().lower() for item in value if str(item).strip()]
    return []


def clamp_initial_sync_days(days: int | float | None) -> int:
    try:
        return max(1, int(days))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return DEFAULT_INITIAL_SYNC_DAYS


def clamp_initial_sync_max_messages(limit: int | float | None) -> int:
    try:
        return max(1, int(limit))  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return DEFAULT_INITIAL_SYNC_MAX


def email_channel_platform_id(host: str, port: int, username: str, folder: str) -> str:
    """Stable email channel key: ``host:port/username/folder``.

    Host/port are included so two mailboxes that share a username (or the same
    username on different providers) do not collide in ``channels`` /
    ``messages`` / ``task_channels``.
    """
    return f"{host.strip()}:{int(port)}/{username.strip()}/{folder}"


def is_host_qualified_email_channel_id(platform_id: str) -> bool:
    """Return True when *platform_id* already uses the host:port/... shape."""
    if "/" not in platform_id or ":" not in platform_id:
        return False
    head, _rest = platform_id.split("/", 1)
    if ":" not in head:
        return False
    _host, port_text = head.rsplit(":", 1)
    return port_text.isdigit()


def format_imap_error(exc: BaseException, *, host: str = "", username: str = "") -> str:
    """Return a user-friendly Chinese message for IMAP errors (no raw bytes)."""
    raw = str(exc)
    lowered = raw.lower()
    is_auth_failure = (
        "authenticationfailed" in lowered
        or "invalid credentials" in lowered
        or exc.__class__.__name__ == "MailboxLoginError"
    )
    if not is_auth_failure:
        return "IMAP 連線失敗，請檢查主機、埠號與帳號設定。"

    host_lower = host.strip().lower()
    username_lower = username.strip().lower()
    is_gmail = host_lower == "imap.gmail.com" or username_lower.endswith("@gmail.com")
    is_outlook = (
        "outlook" in host_lower
        or "office365" in host_lower
        or username_lower.endswith(("@outlook.com", "@hotmail.com", "@live.com"))
    )

    if is_gmail:
        return (
            "Gmail IMAP 登入失敗：帳號或 App Password 不正確。"
            "請確認已在 Google 帳戶啟用 IMAP，並建立 App Password（請勿使用一般登入密碼）。"
        )
    if is_outlook:
        return "Outlook IMAP 登入失敗：帳號或 App Password 不正確。請在 Microsoft 帳戶建立 App Password 後再試。"
    return "IMAP 登入失敗：帳號或密碼不正確。若信箱供應商要求，請使用 App Password 而非一般登入密碼。"


def build_email_credentials(
    *,
    imap_host: str,
    imap_port: int,
    use_ssl: bool,
    username: str,
    password: str,
    folders: Any,
    poll_interval_seconds: int | float | None,
    initial_sync_days: int | float | None,
    initial_sync_max_messages: int | float | None,
    sender_allowlist: Any,
    mark_as_read: bool,
    folder_cursors: dict[str, int] | None = None,
    folder_uidvalidities: dict[str, int] | None = None,
) -> dict[str, Any]:
    return {
        "imap_host": imap_host.strip(),
        "imap_port": int(imap_port),
        "use_ssl": use_ssl,
        "username": username.strip(),
        "password": password.strip() if isinstance(password, str) else password,
        "folders": normalize_folders(folders),
        "poll_interval_seconds": clamp_poll_interval(poll_interval_seconds),
        "initial_sync_days": clamp_initial_sync_days(initial_sync_days),
        "initial_sync_max_messages": clamp_initial_sync_max_messages(initial_sync_max_messages),
        "sender_allowlist": normalize_allowlist(sender_allowlist),
        "mark_as_read": mark_as_read,
        "folder_cursors": dict(folder_cursors or {}),
        "folder_uidvalidities": dict(folder_uidvalidities or {}),
    }


def merge_email_credentials(existing: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    """Merge a partial patch dict into stored credentials (snake_case keys)."""
    merged = dict(existing)
    if patch.get("imap_host") is not None:
        merged["imap_host"] = str(patch["imap_host"]).strip()
    if patch.get("imap_port") is not None:
        merged["imap_port"] = int(patch["imap_port"])
    if patch.get("use_ssl") is not None:
        merged["use_ssl"] = bool(patch["use_ssl"])
    if patch.get("username") is not None:
        merged["username"] = str(patch["username"]).strip()
    password = patch.get("password")
    if password is not None and password not in ("", MASKED_SECRET):
        merged["password"] = str(password).strip()
    if patch.get("folders") is not None:
        merged["folders"] = normalize_folders(patch["folders"])
    if patch.get("poll_interval_seconds") is not None:
        merged["poll_interval_seconds"] = clamp_poll_interval(patch["poll_interval_seconds"])
    if patch.get("initial_sync_days") is not None:
        merged["initial_sync_days"] = clamp_initial_sync_days(patch["initial_sync_days"])
    if patch.get("initial_sync_max_messages") is not None:
        merged["initial_sync_max_messages"] = clamp_initial_sync_max_messages(patch["initial_sync_max_messages"])
    if patch.get("sender_allowlist") is not None:
        merged["sender_allowlist"] = normalize_allowlist(patch["sender_allowlist"])
    if patch.get("mark_as_read") is not None:
        merged["mark_as_read"] = bool(patch["mark_as_read"])
    if patch.get("reset_cursors"):
        merged["folder_cursors"] = {}
        merged["folder_uidvalidities"] = {}
    else:
        if "folder_cursors" not in merged:
            merged["folder_cursors"] = {}
        if "folder_uidvalidities" not in merged:
            merged["folder_uidvalidities"] = {}
    return merged


__all__ = [
    "DEFAULT_FOLDERS",
    "DEFAULT_INITIAL_SYNC_DAYS",
    "DEFAULT_INITIAL_SYNC_MAX",
    "DEFAULT_POLL_INTERVAL",
    "build_email_credentials",
    "clamp_initial_sync_days",
    "clamp_initial_sync_max_messages",
    "default_imap_port",
    "email_channel_platform_id",
    "format_imap_error",
    "is_host_qualified_email_channel_id",
    "merge_email_credentials",
    "normalize_allowlist",
    "normalize_folders",
]

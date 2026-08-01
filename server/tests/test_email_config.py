"""Unit tests for email credential normalization."""

from server.collector.email_config import (
    build_email_credentials,
    email_channel_platform_id,
    format_imap_error,
    is_host_qualified_email_channel_id,
    merge_email_credentials,
    normalize_allowlist,
    normalize_folders,
)
from server.secrets import MASKED_SECRET


class _FakeMailboxLoginError(Exception):
    """Stand-in for imap_tools.errors.MailboxLoginError in unit tests."""


def test_email_channel_platform_id_includes_host_port():
    assert (
        email_channel_platform_id("imap.example.com", 993, "user@example.com", "INBOX")
        == "imap.example.com:993/user@example.com/INBOX"
    )
    assert email_channel_platform_id(" imap.gmail.com ", 993, " a@b.com ", "Sent") == "imap.gmail.com:993/a@b.com/Sent"


def test_is_host_qualified_email_channel_id():
    assert is_host_qualified_email_channel_id("imap.example.com:993/user@example.com/INBOX")
    assert not is_host_qualified_email_channel_id("user@example.com/INBOX")
    assert not is_host_qualified_email_channel_id("imap.example.com/user/INBOX")


def test_format_imap_error_gmail_auth_failure():
    exc = Exception(
        'Response status "OK" expected, but "NO" received. '
        "Data: [b'[AUTHENTICATIONFAILED] Invalid credentials (Failure)']"
    )
    msg = format_imap_error(exc, host="imap.gmail.com", username="user@gmail.com")
    assert "Gmail" in msg
    assert "App Password" in msg
    assert "AUTHENTICATIONFAILED" not in msg
    assert "b'" not in msg


def test_format_imap_error_outlook_auth_failure():
    exc = _FakeMailboxLoginError("Invalid credentials")
    msg = format_imap_error(exc, host="outlook.office365.com", username="user@outlook.com")
    assert "Outlook" in msg
    assert "App Password" in msg


def test_format_imap_error_generic_auth_failure():
    exc = _FakeMailboxLoginError("[AUTHENTICATIONFAILED] Invalid credentials")
    msg = format_imap_error(exc, host="imap.example.com", username="user@example.com")
    assert "登入失敗" in msg
    assert "App Password" in msg


def test_format_imap_error_non_auth_failure():
    exc = ValueError("Connection timed out")
    msg = format_imap_error(exc, host="imap.gmail.com", username="user@gmail.com")
    assert "連線失敗" in msg
    assert "App Password" not in msg


def test_build_email_credentials_strips_password_whitespace():
    creds = build_email_credentials(
        imap_host="imap.gmail.com",
        imap_port=993,
        use_ssl=True,
        username="user@gmail.com",
        password="  secret  ",
        folders=["INBOX"],
        poll_interval_seconds=300,
        initial_sync_days=7,
        initial_sync_max_messages=100,
        sender_allowlist=[],
        mark_as_read=False,
    )
    assert creds["password"] == "secret"


def test_merge_email_credentials_strips_password_whitespace():
    existing = build_email_credentials(
        imap_host="imap.gmail.com",
        imap_port=993,
        use_ssl=True,
        username="user@gmail.com",
        password="old-secret",
        folders=["INBOX"],
        poll_interval_seconds=300,
        initial_sync_days=7,
        initial_sync_max_messages=100,
        sender_allowlist=[],
        mark_as_read=False,
    )
    merged = merge_email_credentials(existing, {"password": "  new-secret  "})
    assert merged["password"] == "new-secret"


def test_normalize_allowlist_accepts_comma_and_newlines():
    assert normalize_allowlist("A@x.com, B@y.com\nC@z.com") == ["a@x.com", "b@y.com", "c@z.com"]


def test_normalize_folders_accepts_comma_and_newlines():
    assert normalize_folders("INBOX, Sent\nArchive") == ["INBOX", "Sent", "Archive"]


def test_build_email_credentials_defaults():
    creds = build_email_credentials(
        imap_host=" imap.gmail.com ",
        imap_port=993,
        use_ssl=True,
        username=" user@gmail.com ",
        password="secret",
        folders="INBOX, Sent",
        poll_interval_seconds=30,
        initial_sync_days=0,
        initial_sync_max_messages=0,
        sender_allowlist=[],
        mark_as_read=False,
    )
    assert creds["imap_host"] == "imap.gmail.com"
    assert creds["username"] == "user@gmail.com"
    assert creds["folders"] == ["INBOX", "Sent"]
    assert creds["poll_interval_seconds"] == 60
    assert creds["initial_sync_days"] == 1
    assert creds["initial_sync_max_messages"] == 1
    assert creds["folder_cursors"] == {}
    assert creds["folder_uidvalidities"] == {}


def test_merge_email_credentials_keeps_password_when_masked():
    existing = build_email_credentials(
        imap_host="imap.gmail.com",
        imap_port=993,
        use_ssl=True,
        username="user@gmail.com",
        password="real-secret",
        folders=["INBOX"],
        poll_interval_seconds=300,
        initial_sync_days=7,
        initial_sync_max_messages=100,
        sender_allowlist=[],
        mark_as_read=False,
        folder_cursors={"INBOX": 10},
    )
    merged = merge_email_credentials(existing, {"password": MASKED_SECRET, "poll_interval_seconds": 120})
    assert merged["password"] == "real-secret"
    assert merged["poll_interval_seconds"] == 120
    assert merged["folder_cursors"] == {"INBOX": 10}


def test_merge_email_credentials_can_reset_cursors():
    existing = build_email_credentials(
        imap_host="imap.gmail.com",
        imap_port=993,
        use_ssl=True,
        username="user@gmail.com",
        password="real-secret",
        folders=["INBOX"],
        poll_interval_seconds=300,
        initial_sync_days=7,
        initial_sync_max_messages=100,
        sender_allowlist=[],
        mark_as_read=False,
        folder_cursors={"INBOX": 10},
    )
    merged = merge_email_credentials(existing, {"reset_cursors": True})
    assert merged["folder_cursors"] == {}
    assert merged["folder_uidvalidities"] == {}

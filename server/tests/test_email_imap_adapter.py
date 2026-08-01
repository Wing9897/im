"""Email IMAP adapter unit tests (mocked imap-tools)."""

from __future__ import annotations

import asyncio
import json
import threading
from datetime import datetime, timezone
from types import SimpleNamespace
from typing import AsyncIterator

import pytest

from server.account_credentials import mutate_account_credentials
from server.collector.adapter_factory import build_adapter
from server.collector.email_imap import EmailImapAdapter, from_addresses, html_to_text
from server.db.database import Database
from server.secrets import protect_text, unprotect_text
from server.sse import SseBroadcaster
from server.tests.db_helpers import insert_minimal_account


@pytest.fixture
async def db(tmp_path) -> AsyncIterator[Database]:
    database = Database(str(tmp_path / "email-adapter.db"))
    await database.connect()
    await database.ensure_schema()
    yield database
    await database.close()


@pytest.fixture
def broadcaster() -> SseBroadcaster:
    return SseBroadcaster()


def test_html_to_text_strips_tags():
    assert html_to_text("<p>Hello <b>world</b></p>") == "Hello world"


def test_from_addresses_accepts_single_imap_tools_shape():
    sender = SimpleNamespace(name="Sender", email="sender@example.com")
    msg = SimpleNamespace(from_values=sender)
    assert from_addresses(msg) == [sender]


def test_from_addresses_accepts_list_shape():
    sender = SimpleNamespace(name="Sender", email="sender@example.com")
    msg = SimpleNamespace(from_values=[sender])
    assert from_addresses(msg) == [sender]


def test_sender_allowlist_matches_exact_email_or_domain(db, broadcaster):
    adapter = EmailImapAdapter(
        "a-email",
        db,
        broadcaster,
        imap_host="imap.gmail.com",
        imap_port=993,
        username="user@gmail.com",
        password="secret",
        sender_allowlist=["gmail.com", "other@example.com"],
    )
    gmail_msg = SimpleNamespace(from_values=SimpleNamespace(name="Google", email="alerts@gmail.com"))
    other_msg = SimpleNamespace(from_values=SimpleNamespace(name="Other", email="other@example.com"))
    spam_msg = SimpleNamespace(from_values=SimpleNamespace(name="Spam", email="spam@notgmail.com"))

    assert adapter._sender_allowed(gmail_msg) is True
    assert adapter._sender_allowed(other_msg) is True
    assert adapter._sender_allowed(spam_msg) is False


def test_factory_builds_email_adapter(db, broadcaster, tmp_path):
    adapter = build_adapter(
        "a-email",
        "email",
        {
            "imap_host": "imap.gmail.com",
            "username": "user@gmail.com",
            "password": "secret",
            "folders": ["INBOX"],
            "poll_interval_seconds": 120,
            "folder_cursors": {"INBOX": 42},
        },
        db=db,
        broadcaster=broadcaster,
        session_dir=str(tmp_path),
    )
    assert isinstance(adapter, EmailImapAdapter)
    assert adapter._poll_interval == 120
    assert adapter._folder_cursors["INBOX"] == 42


class _FakeFolderInfo:
    def __init__(self, name: str) -> None:
        self.name = name


class _FakeFolderManager:
    def __init__(self, names: list[str], uid_validity: int = 1) -> None:
        self._names = names
        self.current = "INBOX"
        self.uid_validity = uid_validity

    def list(self, *_args, **_kwargs):
        return [_FakeFolderInfo(name) for name in self._names]

    def set(self, name: str) -> None:
        self.current = name

    def status(self, folder=None, options=None):
        return {"UIDVALIDITY": self.uid_validity}


class _FakeMailbox:
    def __init__(
        self,
        messages_by_folder: dict[str, list],
        folder_names: list[str] | None = None,
        uid_validity: int = 1,
    ) -> None:
        self.folder = _FakeFolderManager(folder_names or list(messages_by_folder.keys()), uid_validity)
        self._messages_by_folder = messages_by_folder
        self.flagged: list[tuple[list[int], bool]] = []

    def fetch(self, criteria=None, *, limit=None, reverse=False, mark_seen=False):
        folder = self.folder.current
        messages = list(self._messages_by_folder.get(folder, []))
        if reverse:
            messages = list(reversed(messages))
        if limit is not None:
            messages = messages[:limit]
        return iter(messages)

    def flag(self, uids, _flag, value: bool) -> None:
        self.flagged.append((list(uids), value))

    def login(self, *_args, **_kwargs):
        return self

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False


def _make_message(*, uid: int, subject: str = "Subject", body: str = "Body", msg_id: str | None = None):
    return SimpleNamespace(
        uid=str(uid),
        subject=subject,
        text=body,
        html="",
        msg_id=msg_id or f"<msg-{uid}@example.com>",
        message_id=msg_id or f"<msg-{uid}@example.com>",
        date=datetime(2026, 1, 1, tzinfo=timezone.utc),
        from_values=SimpleNamespace(name="Sender", email="sender@example.com"),
        attachments=[],
    )


async def test_email_adapter_initial_sync_and_cursor_persist(db, broadcaster, monkeypatch, tmp_path):
    await insert_minimal_account(db, "a-email", "email")
    messages = [_make_message(uid=10), _make_message(uid=11, subject="Second")]
    fake_mailbox = _FakeMailbox({"INBOX": messages})

    async def allow_host(*_args, **_kwargs):
        return None

    monkeypatch.setattr("server.collector.email_imap.validate_imap_host", allow_host)
    monkeypatch.setattr("imap_tools.MailBox", lambda *_a, **_k: fake_mailbox)

    adapter = EmailImapAdapter(
        "a-email",
        db,
        broadcaster,
        imap_host="imap.gmail.com",
        imap_port=993,
        username="user@gmail.com",
        password="secret",
        folders=["INBOX"],
        poll_interval_seconds=60,
        initial_sync_days=7,
        initial_sync_max_messages=100,
    )

    await adapter.connect()
    try:
        adapter._poll_interval = 0
        await adapter._poll_once()

        count = await db.fetch_value("SELECT COUNT(*) FROM messages")
        assert count == 2

        row = await db.fetch_one("SELECT credentials FROM accounts WHERE id = 'a-email'")
        assert row is not None
        creds = json.loads(unprotect_text(row["credentials"]))
        assert creds["folder_cursors"]["INBOX"] == 11
    finally:
        await adapter.disconnect()


async def test_email_adapter_connect_auth_failure_raises_friendly_value_error(db, broadcaster, monkeypatch):
    await insert_minimal_account(db, "a-email", "email")

    async def allow_host(*_args, **_kwargs):
        return None

    class _AuthFailMailbox:
        def login(self, *_args, **_kwargs):
            from imap_tools.errors import MailboxLoginError

            raise MailboxLoginError(
                ("NO", [b"[AUTHENTICATIONFAILED] Invalid credentials (Failure)"]),
                "OK",
            )

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

    monkeypatch.setattr("server.collector.email_imap.validate_imap_host", allow_host)
    monkeypatch.setattr("imap_tools.MailBox", lambda *_a, **_k: _AuthFailMailbox())

    adapter = EmailImapAdapter(
        "a-email",
        db,
        broadcaster,
        imap_host="imap.gmail.com",
        imap_port=993,
        username="user@gmail.com",
        password="wrong",
        folders=["INBOX"],
    )

    with pytest.raises(ValueError, match="Gmail.*App Password"):
        await adapter.connect()


async def test_email_adapter_incremental_uid_skips_old(db, broadcaster, monkeypatch):
    await insert_minimal_account(db, "a-email", "email")
    messages = [_make_message(uid=12, subject="New only")]
    fake_mailbox = _FakeMailbox({"INBOX": messages})

    async def allow_host(*_args, **_kwargs):
        return None

    monkeypatch.setattr("server.collector.email_imap.validate_imap_host", allow_host)
    monkeypatch.setattr("imap_tools.MailBox", lambda *_a, **_k: fake_mailbox)

    adapter = EmailImapAdapter(
        "a-email",
        db,
        broadcaster,
        imap_host="imap.gmail.com",
        imap_port=993,
        username="user@gmail.com",
        password="secret",
        folders=["INBOX"],
        poll_interval_seconds=60,
        folder_cursors={"INBOX": 11},
    )

    await adapter.connect()
    try:
        await adapter._poll_once()
        rows = await db.fetch_all("SELECT platform_message_id FROM messages")
        assert len(rows) == 1
        assert rows[0]["platform_message_id"] == "<msg-12@example.com>"
    finally:
        await adapter.disconnect()


async def test_email_adapter_connect_twice_cancels_previous_poll_task(db, broadcaster, monkeypatch):
    async def allow_host(*_args, **_kwargs):
        return None

    started = 0
    cancelled = 0

    async def poll_forever():
        nonlocal started, cancelled
        started += 1
        try:
            await asyncio.Event().wait()
        except asyncio.CancelledError:
            cancelled += 1
            raise

    adapter = EmailImapAdapter(
        "a-email",
        db,
        broadcaster,
        imap_host="imap.example.com",
        imap_port=993,
        username="user@example.com",
        password="secret",
    )
    monkeypatch.setattr("server.collector.email_imap.validate_imap_host", allow_host)
    monkeypatch.setattr(adapter, "_verify_login_and_folders", lambda: None)
    monkeypatch.setattr(adapter, "_poll_loop", poll_forever)

    await adapter.connect()
    first_task = adapter._poll_task
    await asyncio.sleep(0)
    await adapter.connect()
    await asyncio.sleep(0)

    assert first_task is not None and first_task.done()
    assert adapter._poll_task is not first_task
    assert started == 2
    assert cancelled == 1
    await adapter.disconnect()


async def test_folder_level_auth_failure_is_not_swallowed(db, broadcaster, monkeypatch):
    from imap_tools.errors import MailboxLoginError

    adapter = EmailImapAdapter(
        "a-email",
        db,
        broadcaster,
        imap_host="imap.example.com",
        imap_port=993,
        username="user@example.com",
        password="secret",
        folders=["INBOX"],
    )
    mailbox = _FakeMailbox({"INBOX": []})
    monkeypatch.setattr(adapter, "_open_mailbox", lambda: mailbox)

    def raise_auth(*_args, **_kwargs):
        raise MailboxLoginError(("NO", [b"AUTHENTICATIONFAILED"]), "OK")

    monkeypatch.setattr(adapter, "_fetch_folder", raise_auth)
    with pytest.raises(MailboxLoginError):
        adapter._fetch_all_folders({}, {})


async def test_atomic_credential_mutations_preserve_concurrent_patch_and_cursor(db):
    await insert_minimal_account(db, "a-email", "email")
    initial = {
        "password": "old-secret",
        "poll_interval_seconds": 60,
        "folder_cursors": {"INBOX": 5},
    }
    await db.execute(
        "UPDATE accounts SET credentials = ? WHERE id = ?",
        (protect_text(json.dumps(initial)), "a-email"),
    )

    def patch_password(current):
        current["password"] = "new-secret"
        current["poll_interval_seconds"] = 120
        return current

    def advance_cursor(current):
        cursors = dict(current.get("folder_cursors") or {})
        cursors["INBOX"] = 9
        current["folder_cursors"] = cursors
        return current

    await asyncio.gather(
        mutate_account_credentials(db, "a-email", patch_password),
        mutate_account_credentials(db, "a-email", advance_cursor),
    )

    row = await db.fetch_one("SELECT credentials FROM accounts WHERE id = ?", ("a-email",))
    assert row is not None
    credentials = json.loads(unprotect_text(row["credentials"]))
    assert credentials["password"] == "new-secret"
    assert credentials["poll_interval_seconds"] == 120
    assert credentials["folder_cursors"] == {"INBOX": 9}


async def test_uidvalidity_change_resets_stale_folder_cursor(db, broadcaster, monkeypatch):
    await insert_minimal_account(db, "a-email-uid", "email")
    await db.execute(
        "UPDATE accounts SET credentials = ? WHERE id = ?",
        (
            protect_text(
                json.dumps(
                    {
                        "folder_cursors": {"INBOX": 100},
                        "folder_uidvalidities": {"INBOX": 1},
                    }
                )
            ),
            "a-email-uid",
        ),
    )
    fake_mailbox = _FakeMailbox({"INBOX": [_make_message(uid=2)]}, uid_validity=2)
    monkeypatch.setattr("imap_tools.MailBox", lambda *_args, **_kwargs: fake_mailbox)
    adapter = EmailImapAdapter(
        "a-email-uid",
        db,
        broadcaster,
        imap_host="imap.example.com",
        imap_port=993,
        username="user@example.com",
        password="secret",
        folders=["INBOX"],
        folder_cursors={"INBOX": 100},
        folder_uidvalidities={"INBOX": 1},
    )

    await adapter._poll_once()

    row = await db.fetch_one("SELECT credentials FROM accounts WHERE id = ?", ("a-email-uid",))
    assert row is not None
    credentials = json.loads(unprotect_text(row["credentials"]))
    assert credentials["folder_cursors"] == {"INBOX": 2}
    assert credentials["folder_uidvalidities"] == {"INBOX": 2}
    assert adapter._folder_cursors == {"INBOX": 2}


async def test_disconnect_drains_inflight_imap_thread(db, broadcaster, monkeypatch):
    started = threading.Event()
    release = threading.Event()
    adapter = EmailImapAdapter(
        "a-email-drain",
        db,
        broadcaster,
        imap_host="imap.example.com",
        imap_port=993,
        username="user@example.com",
        password="secret",
    )

    def blocking_fetch(*_args):
        started.set()
        release.wait(timeout=2)
        return []

    monkeypatch.setattr(adapter, "_fetch_all_folders", blocking_fetch)
    adapter._poll_task = asyncio.create_task(adapter._poll_loop())
    while not started.is_set():
        await asyncio.sleep(0)

    disconnect = asyncio.create_task(adapter.disconnect())
    await asyncio.sleep(0)
    assert not disconnect.done()

    release.set()
    await asyncio.wait_for(disconnect, timeout=1)
    assert not adapter._blocking_tasks

"""Unit tests for HTTP poll adapter helpers and adapter smoke."""

from __future__ import annotations

import asyncio
import base64
from typing import AsyncIterator

import pytest

from server.collector.adapter_factory import build_adapter
from server.collector.http_poll import (
    DEFAULT_MAX_CONTENT_CHARS,
    HttpPollAdapter,
    HttpPollContentError,
    build_request_headers,
    clamp_max_content_chars,
    normalize_http_credentials,
    prepare_message_content,
    response_content_hash,
)
from server.collector.poll_config import clamp_poll_interval
from server.db.database import Database
from server.sse import SseBroadcaster
from server.tests.db_helpers import insert_minimal_account


@pytest.fixture
async def db(tmp_path) -> AsyncIterator[Database]:
    database = Database(str(tmp_path / "http-poll-test.db"))
    await database.connect()
    await database.ensure_schema()
    yield database
    await database.close()


@pytest.fixture
def broadcaster() -> SseBroadcaster:
    return SseBroadcaster()


def test_clamp_poll_interval_bounds():
    assert clamp_poll_interval(10) == 60
    assert clamp_poll_interval(300) == 300
    assert clamp_poll_interval(999_999) == 86400
    assert clamp_poll_interval(None) == 300


def test_clamp_max_content_chars():
    assert clamp_max_content_chars(None) == DEFAULT_MAX_CONTENT_CHARS
    assert clamp_max_content_chars(100) == 100
    assert clamp_max_content_chars(999_999) == 100_000
    assert clamp_max_content_chars(0) == 1


def test_build_request_headers_bearer_overrides_user_authorization():
    headers = build_request_headers(
        {
            "auth_type": "bearer",
            "bearer_token": "secret-token",
            "headers": {"Authorization": "Bearer user-should-lose", "X-Custom": "1"},
            "body_type": "none",
        }
    )
    assert headers["Authorization"] == "Bearer secret-token"
    assert headers["X-Custom"] == "1"


def test_build_request_headers_basic():
    headers = build_request_headers(
        {
            "auth_type": "basic",
            "basic_username": "alice",
            "basic_password": "wonder",
            "headers": {},
            "body_type": "none",
        }
    )
    expected = base64.b64encode(b"alice:wonder").decode("ascii")
    assert headers["Authorization"] == f"Basic {expected}"


def test_prepare_message_content_truncates_text():
    text = "a" * 100
    result = prepare_message_content(text, content_type="text/plain", max_chars=20)
    assert result.endswith("…[truncated]")
    assert len(result) == 20


def test_prepare_message_content_json_over_max_fails():
    payload = '{"k":"' + ("x" * 50) + '"}'
    with pytest.raises(HttpPollContentError):
        prepare_message_content(payload, content_type="application/json", max_chars=10)


def test_prepare_message_content_json_ok():
    payload = '{"ok":true}'
    assert prepare_message_content(payload, content_type="application/json", max_chars=100) == payload


def test_response_content_hash_stable_and_short():
    a = response_content_hash("GET", "https://example.com", b"hello")
    b = response_content_hash("GET", "https://example.com", b"hello")
    c = response_content_hash("POST", "https://example.com", b"hello")
    assert a == b
    assert a != c
    assert len(a) == 16


def test_normalize_requires_url_and_auth():
    with pytest.raises(ValueError, match="URL"):
        normalize_http_credentials({})
    with pytest.raises(ValueError, match="bearer_token"):
        normalize_http_credentials({"url": "https://example.com", "auth_type": "bearer"})
    with pytest.raises(ValueError, match="basic_username"):
        normalize_http_credentials({"url": "https://example.com", "auth_type": "basic"})


@pytest.mark.asyncio
async def test_outbound_url_rejects_embedded_credentials():
    from server.outbound import OutboundUrlError, validate_outbound_url

    with pytest.raises(OutboundUrlError, match="Credentials"):
        await validate_outbound_url("https://user:pass@example.com/api")


def test_factory_builds_http_adapter(db, broadcaster, tmp_path):
    adapter = build_adapter(
        "a-1",
        "http",
        {"url": "https://example.com/api"},
        db=db,
        broadcaster=broadcaster,
        session_dir=str(tmp_path),
    )
    assert isinstance(adapter, HttpPollAdapter)
    assert adapter.state.platform == "http"


def test_factory_missing_http_url_returns_none(db, broadcaster, tmp_path):
    adapter = build_adapter(
        "a-1",
        "http",
        {},
        db=db,
        broadcaster=broadcaster,
        session_dir=str(tmp_path),
    )
    assert adapter is None


class _FakeHttpResponse:
    def __init__(self, body: bytes, content_type: str = "text/plain") -> None:
        self._body = body
        self.status = 200
        self.headers = {"Content-Type": content_type}

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc_info):
        return False

    def raise_for_status(self) -> None:
        pass

    async def read(self) -> bytes:
        return self._body


class _FakeHttpSession:
    def __init__(self, payloads: list[bytes]) -> None:
        self._payloads = list(payloads)
        self._index = 0
        self.closed = False
        self.requests: list[tuple[str, str, dict]] = []

    def set_payloads(self, payloads: list[bytes]) -> None:
        self._payloads = list(payloads)
        self._index = 0

    def request(self, method: str, url: str, **kwargs):
        self.requests.append((method, url, kwargs))
        if not self._payloads:
            body = b""
        elif self._index >= len(self._payloads):
            body = self._payloads[-1]
        else:
            body = self._payloads[self._index]
            self._index += 1
        return _FakeHttpResponse(body)

    async def close(self) -> None:
        self.closed = True


@pytest.mark.asyncio
async def test_http_adapter_connect_ingest_dedupe_disconnect(db, broadcaster, monkeypatch):
    await insert_minimal_account(db, "a-http", "http")
    fake_session = _FakeHttpSession([b"hello-world"])

    async def allow_url(*_args, **_kwargs):
        return None

    def create_session(**_kwargs):
        return fake_session

    monkeypatch.setattr("server.collector.http_poll.aiohttp.ClientSession", create_session)
    monkeypatch.setattr("server.collector.http_poll.validate_outbound_url", allow_url)

    adapter = HttpPollAdapter(
        "a-http",
        db,
        broadcaster,
        {"url": "https://example.com/status", "poll_interval_seconds": 60},
    )
    adapter._poll_interval = 0.01
    queue = broadcaster.subscribe()
    try:
        await adapter.connect()
        assert await adapter.is_connected()
        assert await db.fetch_value("SELECT COUNT(*) FROM messages") == 1

        # Same body on subsequent polls must not insert again.
        await asyncio.sleep(0.05)
        assert await db.fetch_value("SELECT COUNT(*) FROM messages") == 1

        # Changed body inserts a second message.
        fake_session.set_payloads([b"changed"])
        for _ in range(200):
            if await db.fetch_value("SELECT COUNT(*) FROM messages") == 2:
                break
            await asyncio.sleep(0.01)
        assert await db.fetch_value("SELECT COUNT(*) FROM messages") == 2

        row = await db.fetch_one("SELECT * FROM messages ORDER BY created_at ASC LIMIT 1")
        assert row["platform"] == "http"
        assert row["content"] == "hello-world"
        assert len(row["platform_message_id"]) == 16
    finally:
        await adapter.disconnect()
        broadcaster.unsubscribe(queue)

    assert fake_session.closed
    assert not await adapter.is_connected()


@pytest.mark.asyncio
async def test_http_adapter_json_oversize_marks_error(db, broadcaster, monkeypatch):
    await insert_minimal_account(db, "a-http-json", "http")
    oversized = ('{"data":"' + ("x" * 200) + '"}').encode("utf-8")

    async def allow_url(*_args, **_kwargs):
        return None

    class _TypedSession(_FakeHttpSession):
        def request(self, method: str, url: str, **kwargs):
            self.requests.append((method, url, kwargs))
            if not self._payloads:
                body = b""
            elif self._index >= len(self._payloads):
                body = self._payloads[-1]
            else:
                body = self._payloads[self._index]
                self._index += 1
            return _FakeHttpResponse(body, content_type="application/json")

    typed = _TypedSession([b'{"ok":true}'])
    monkeypatch.setattr("server.collector.http_poll.aiohttp.ClientSession", lambda **_k: typed)
    monkeypatch.setattr("server.collector.http_poll.validate_outbound_url", allow_url)

    adapter = HttpPollAdapter(
        "a-http-json",
        db,
        broadcaster,
        {
            "url": "https://example.com/json",
            "max_content_chars": 40,
            "poll_interval_seconds": 60,
        },
    )
    adapter._poll_interval = 0.01
    try:
        await adapter.connect()
        assert await db.fetch_value("SELECT COUNT(*) FROM messages") == 1
        typed.set_payloads([oversized])
        for _ in range(200):
            if adapter.state.status == "error":
                break
            await asyncio.sleep(0.01)
        assert adapter.state.status == "error"
        assert "max_content_chars" in (adapter.state.last_error or "")
        # Oversized JSON must not insert.
        assert await db.fetch_value("SELECT COUNT(*) FROM messages") == 1
    finally:
        await adapter.disconnect()

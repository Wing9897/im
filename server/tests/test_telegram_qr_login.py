"""Unit tests for Telegram QR login adapter helpers."""

from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from typing import cast
from unittest.mock import AsyncMock, MagicMock

import pytest
from telethon import TelegramClient, errors
from telethon.tl.custom.qrlogin import QRLogin

from server.collector.telegram import TelegramAdapter


class _FakeQrLogin:
    def __init__(self, *, url: str = "tg://login?token=demo", expires_in: float = 60.0) -> None:
        self.url = url
        self.expires = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        self.wait = AsyncMock()
        self.recreate = AsyncMock()


def _attach_qr(adapter: TelegramAdapter, fake_qr: _FakeQrLogin) -> None:
    """Put the adapter in the mid-QR-login state these tests resume from."""
    adapter._client = cast(TelegramClient, object())
    adapter._qr_login = cast(QRLogin, fake_qr)


@pytest.mark.asyncio
async def test_start_qr_login_returns_qr_payload(monkeypatch):
    adapter = TelegramAdapter("acc-1", MagicMock(), MagicMock(), 1, "hash", session_dir=".")
    fake_client = AsyncMock()
    fake_client.is_user_authorized = AsyncMock(return_value=False)
    fake_qr = _FakeQrLogin()

    monkeypatch.setattr(adapter, "disconnect", AsyncMock())
    monkeypatch.setattr(adapter, "_create_client", lambda: fake_client)
    fake_client.qr_login = AsyncMock(return_value=fake_qr)

    result = await adapter.start_qr_login(11, "new-hash")
    assert result["next_step"] == "qr_required"
    assert result["qr_url"] == "tg://login?token=demo"
    assert result["qr_expires_at"].endswith("Z")
    assert adapter._api_id == 11
    assert adapter._api_hash == "new-hash"


@pytest.mark.asyncio
async def test_wait_qr_login_timeout_keeps_same_qr(monkeypatch):
    adapter = TelegramAdapter("acc-1", MagicMock(), MagicMock(), 1, "hash", session_dir=".")
    fake_qr = _FakeQrLogin(expires_in=40.0)
    fake_qr.wait.side_effect = asyncio.TimeoutError()
    _attach_qr(adapter, fake_qr)

    result = await adapter.wait_qr_login(timeout=5)
    assert result["next_step"] == "qr_required"
    assert result["qr_url"] == "tg://login?token=demo"
    fake_qr.recreate.assert_not_awaited()


@pytest.mark.asyncio
async def test_wait_qr_login_expired_recreates(monkeypatch):
    adapter = TelegramAdapter("acc-1", MagicMock(), MagicMock(), 1, "hash", session_dir=".")
    fake_qr = _FakeQrLogin(expires_in=-1.0)
    fake_qr.wait.side_effect = asyncio.TimeoutError()

    async def _recreate() -> None:
        fake_qr.url = "tg://login?token=refreshed"
        fake_qr.expires = datetime.now(timezone.utc) + timedelta(seconds=60)

    fake_qr.recreate.side_effect = _recreate
    _attach_qr(adapter, fake_qr)

    result = await adapter.wait_qr_login(timeout=5)
    assert result["next_step"] == "qr_required"
    assert result["qr_url"] == "tg://login?token=refreshed"
    fake_qr.recreate.assert_awaited_once()


@pytest.mark.asyncio
async def test_wait_qr_login_requires_2fa(monkeypatch):
    adapter = TelegramAdapter("acc-1", MagicMock(), MagicMock(), 1, "hash", session_dir=".")
    fake_qr = _FakeQrLogin()
    fake_qr.wait.side_effect = errors.SessionPasswordNeededError(request=SimpleNamespace())
    _attach_qr(adapter, fake_qr)

    result = await adapter.wait_qr_login()
    assert result == {"next_step": "2fa_required"}


@pytest.mark.asyncio
async def test_wait_qr_login_success(monkeypatch):
    adapter = TelegramAdapter("acc-1", MagicMock(), MagicMock(), 1, "hash", session_dir=".")
    fake_qr = _FakeQrLogin()
    fake_qr.wait.return_value = SimpleNamespace(id=1)
    _attach_qr(adapter, fake_qr)
    on_success = AsyncMock()
    monkeypatch.setattr(adapter, "_on_login_success", on_success)

    result = await adapter.wait_qr_login()
    assert result == {"next_step": "connected"}
    on_success.assert_awaited_once()

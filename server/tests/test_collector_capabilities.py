"""Tests for collector capability protocols."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from server.collector.capabilities import DiscordCapable, TelegramLoginCapable, as_discord, as_telegram_login
from server.collector.discord import DiscordAdapter
from server.collector.telegram import TelegramAdapter


def test_discord_adapter_satisfies_discord_capable() -> None:
    adapter = DiscordAdapter("acc-1", MagicMock(), MagicMock(), "token-x")
    assert isinstance(adapter, DiscordCapable)
    assert as_discord(adapter) is adapter


def test_telegram_adapter_satisfies_telegram_login_capable() -> None:
    adapter = TelegramAdapter(
        "acc-1",
        MagicMock(),
        MagicMock(),
        api_id=1,
        api_hash="hash",
        session_dir="/tmp/sessions",
    )
    assert isinstance(adapter, TelegramLoginCapable)
    assert as_telegram_login(adapter) is adapter


def test_as_discord_rejects_non_discord_adapter() -> None:
    adapter = TelegramAdapter(
        "acc-1",
        MagicMock(),
        MagicMock(),
        api_id=1,
        api_hash="hash",
        session_dir="/tmp/sessions",
    )
    with pytest.raises(TypeError, match="Discord-capable"):
        as_discord(adapter)

"""Telegram string session persistence tests."""

from __future__ import annotations

from telethon.sessions import StringSession

from server.collector.telegram_session import (
    load_string_session,
    persist_string_session_token,
    string_session_path,
)


def test_load_string_session_returns_empty_session_when_missing(tmp_path) -> None:
    session = load_string_session(str(tmp_path), "missing-account")

    assert isinstance(session, StringSession)
    assert session.save() == ""


def test_persist_string_session_token_writes_file(tmp_path) -> None:
    account_id = "acc-1"
    token = "1sample-token"

    path = persist_string_session_token(str(tmp_path), account_id, token)

    assert path == string_session_path(str(tmp_path), account_id)
    assert path.read_text(encoding="utf-8") == token


def test_persist_string_session_token_rejects_empty(tmp_path) -> None:
    import pytest

    with pytest.raises(ValueError, match="empty Telegram session"):
        persist_string_session_token(str(tmp_path), "acc-1", "   ")

"""Telegram bounded history backfill — iter_messages + FloodWait."""

from __future__ import annotations

from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock, MagicMock

import pytest
from telethon.errors import FloodWaitError

from server.collector import telegram_ingest
from server.collector.telegram import TelegramAdapter
from server.db.database import Database
from server.sse import SseBroadcaster
from server.tests.db_helpers import insert_source_with_channels


def _tg_message(msg_id: int, text: str = "hello") -> SimpleNamespace:
    return SimpleNamespace(
        id=msg_id,
        message=text,
        date=datetime(2026, 1, 1, 12, 0, tzinfo=UTC),
        sender=SimpleNamespace(id=42, username="alice", first_name=None, title=None),
        photo=None,
        video=None,
        sticker=None,
        voice=None,
        document=None,
    )


async def _setup_source(db: Database, source_id: str, channel_ids: list[str]) -> TelegramAdapter:
    await insert_source_with_channels(
        db,
        source_id,
        "telegram",
        channel_ids,
        name="+123",
        credentials="{}",
    )
    adapter = TelegramAdapter(
        source_id,
        db,
        SseBroadcaster(),
        api_id=1,
        api_hash="hash",
        session_dir="unused",
    )
    client = MagicMock()
    client.is_user_authorized = AsyncMock(return_value=True)
    adapter._client = client
    return adapter


@pytest.mark.asyncio
async def test_backfill_recent_messages_ingests_per_dialog(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    db = Database(str(tmp_path / "tg-backfill.db"))
    await db.connect()
    await db.ensure_schema()
    adapter = await _setup_source(db, "acc-bf-1", ["-1001", "-1002"])

    calls: list[int] = []

    async def _fake_iter(chat_id: int, limit: int = 100):
        calls.append(chat_id)
        assert limit == 100
        for mid in (10, 11):
            yield _tg_message(mid, f"msg-{chat_id}-{mid}")

    cast(Any, adapter._client).iter_messages = _fake_iter
    monkeypatch.setattr(telegram_ingest, "BACKFILL_DIALOG_SLEEP_SECONDS", 0)

    total = await telegram_ingest.backfill_recent_messages(adapter, limit_per_dialog=100)
    assert total == 4
    assert calls == [-1001, -1002]

    count = await db.fetch_value("SELECT COUNT(*) FROM messages WHERE source_id = ?", ("acc-bf-1",))
    assert int(count or 0) == 4
    await db.close()


@pytest.mark.asyncio
async def test_backfill_aborts_remaining_on_long_flood_wait(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    db = Database(str(tmp_path / "tg-flood.db"))
    await db.connect()
    await db.ensure_schema()
    adapter = await _setup_source(db, "acc-bf-flood", ["-2001", "-2002"])

    seen: list[int] = []

    async def _fake_iter(chat_id: int, limit: int = 100):
        del limit
        seen.append(chat_id)
        if chat_id == -2001:
            raise FloodWaitError(request=None, capture=200)
        yield _tg_message(1)

    cast(Any, adapter._client).iter_messages = _fake_iter
    monkeypatch.setattr(telegram_ingest, "BACKFILL_DIALOG_SLEEP_SECONDS", 0)

    total = await telegram_ingest.backfill_recent_messages(adapter)
    assert total == 0
    assert seen == [-2001]  # second dialog never started
    await db.close()


@pytest.mark.asyncio
async def test_backfill_sleeps_and_retries_short_flood_wait(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    db = Database(str(tmp_path / "tg-flood-short.db"))
    await db.connect()
    await db.ensure_schema()
    adapter = await _setup_source(db, "acc-bf-short", ["-3001"])

    attempts = {"n": 0}
    slept: list[float] = []

    async def _fake_iter(chat_id: int, limit: int = 100):
        del chat_id, limit
        attempts["n"] += 1
        if attempts["n"] == 1:
            raise FloodWaitError(request=None, capture=2)
        yield _tg_message(99, "after-wait")

    async def _fake_sleep(seconds: float) -> None:
        slept.append(seconds)

    cast(Any, adapter._client).iter_messages = _fake_iter
    monkeypatch.setattr(telegram_ingest.asyncio, "sleep", _fake_sleep)
    monkeypatch.setattr(telegram_ingest, "BACKFILL_DIALOG_SLEEP_SECONDS", 0)
    monkeypatch.setattr(telegram_ingest.random, "uniform", lambda _a, _b: 0.5)

    total = await telegram_ingest.backfill_recent_messages(adapter)
    assert total == 1
    assert attempts["n"] == 2
    assert slept and slept[0] == pytest.approx(2.5)
    count = await db.fetch_value("SELECT COUNT(*) FROM messages WHERE source_id = ?", ("acc-bf-short",))
    assert int(count or 0) == 1
    await db.close()


@pytest.mark.asyncio
async def test_finish_startup_runs_backfill_once_after_handlers(tmp_path, monkeypatch: pytest.MonkeyPatch) -> None:
    db = Database(str(tmp_path / "tg-startup-bf.db"))
    await db.connect()
    await db.ensure_schema()
    adapter = await _setup_source(db, "acc-startup-bf", ["-4001"])

    order: list[str] = []

    async def _sync() -> int:
        order.append("sync")
        return 0

    async def _register() -> None:
        order.append("handlers")

    async def _backfill(adapter_arg: object, **_kwargs: object) -> int:
        del adapter_arg
        order.append("backfill")
        return 0

    monkeypatch.setattr(adapter, "sync_dialog_channels", _sync)
    monkeypatch.setattr(adapter, "_register_message_handlers", _register)
    monkeypatch.setattr(adapter, "_persist_string_session", lambda: None)
    monkeypatch.setattr(telegram_ingest, "backfill_recent_messages", _backfill)
    monkeypatch.setattr(telegram_ingest.asyncio, "sleep", AsyncMock())
    # _finish_startup uses module telegram_ingest via telegram.py import
    monkeypatch.setattr("server.collector.telegram.asyncio.sleep", AsyncMock())
    monkeypatch.setattr("server.collector.telegram.telegram_ingest.backfill_recent_messages", _backfill)

    await adapter._finish_startup()
    assert order == ["sync", "handlers", "backfill"]
    assert adapter._history_backfill_done is True

    order.clear()
    await adapter._finish_startup()
    assert order == ["sync", "handlers"]  # backfill skipped second time
    await db.close()


@pytest.mark.asyncio
async def test_finish_startup_failure_sets_source_error_and_sse(
    tmp_path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    db = Database(str(tmp_path / "tg-startup-fail.db"))
    await db.connect()
    await db.ensure_schema()
    await insert_source_with_channels(
        db,
        "acc-startup-fail",
        "telegram",
        ["-4002"],
        name="+123",
        credentials="{}",
    )

    events: list[tuple[str, dict]] = []

    class _Rec:
        def publish(self, event_type: str, payload: dict) -> None:
            events.append((event_type, payload))

    adapter = TelegramAdapter(
        "acc-startup-fail",
        db,
        cast(SseBroadcaster, _Rec()),
        api_id=1,
        api_hash="hash",
        session_dir="unused",
    )
    client = MagicMock()
    client.is_user_authorized = AsyncMock(return_value=True)
    adapter._client = client
    adapter._mark_connected()

    async def _boom() -> int:
        raise RuntimeError("dialog sync boom")

    monkeypatch.setattr(adapter, "sync_dialog_channels", _boom)
    monkeypatch.setattr("server.collector.telegram.asyncio.sleep", AsyncMock())

    await adapter._finish_startup()

    assert adapter.state.status == "error"
    assert "dialog sync boom" in str(adapter.state.last_error or "")
    status = await db.fetch_value("SELECT status FROM sources WHERE id = ?", ("acc-startup-fail",))
    last_error = await db.fetch_value("SELECT last_error FROM sources WHERE id = ?", ("acc-startup-fail",))
    assert status == "error"
    assert "dialog sync boom" in str(last_error or "")

    changed = [p for name, p in events if name == "source_status_changed"]
    assert changed
    assert changed[0]["sourceId"] == "acc-startup-fail"
    assert changed[0]["status"] == "error"
    assert "dialog sync boom" in str(changed[0].get("lastError") or "")
    await db.close()


@pytest.mark.asyncio
async def test_ingest_telethon_message_dedups(tmp_path) -> None:
    db = Database(str(tmp_path / "tg-ingest.db"))
    await db.connect()
    await db.ensure_schema()
    adapter = await _setup_source(db, "acc-ingest", ["-5001"])
    msg = _tg_message(7, "once")
    # Avoid TgMessage isinstance gate by calling ingest directly
    await telegram_ingest.ingest_telethon_message(
        adapter,
        message=msg,
        chat_id=-5001,
        channel_name="Channel -5001",
        sender_id="42",
        sender_name="alice",
    )
    await telegram_ingest.ingest_telethon_message(
        adapter,
        message=msg,
        chat_id=-5001,
        channel_name="Channel -5001",
        sender_id="42",
        sender_name="alice",
    )
    count = await db.fetch_value("SELECT COUNT(*) FROM messages WHERE source_id = ?", ("acc-ingest",))
    assert int(count or 0) == 1
    await db.close()

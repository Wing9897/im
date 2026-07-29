"""Tests for bulk sync_account_channels."""

from __future__ import annotations

import pytest
from fastapi import Request

from server.api.routes.accounts.helpers import finalize_source_account, sync_account_channels
from server.queries import accounts_queries
from server.util import new_id, utc_now_iso


@pytest.fixture
async def db(app):
    return app.state.db


async def test_sync_account_channels_bulk_replace(db):
    account_id = new_id()
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO accounts (id, platform, name, status, credentials, created_at, updated_at) "
        "VALUES (?, 'discord', 'Sync Test', 'connected', '{}', ?, ?)",
        (account_id, now, now),
    )
    await sync_account_channels(
        db,
        account_id,
        "discord",
        [("ch-1", "Alpha"), ("ch-2", "Beta")],
    )

    rows = await db.fetch_all(
        "SELECT ac.platform_id, c.channel_name FROM account_channels ac "
        "JOIN channels c ON c.platform = ac.platform AND c.platform_id = ac.platform_id "
        "WHERE ac.account_id = ? ORDER BY ac.platform_id ASC",
        (account_id,),
    )
    assert [(row["platform_id"], row["channel_name"]) for row in rows] == [
        ("ch-1", "Alpha"),
        ("ch-2", "Beta"),
    ]

    await sync_account_channels(db, account_id, "discord", [("ch-2", "Beta"), ("ch-3", "Gamma")])

    rows = await db.fetch_all(
        "SELECT ac.platform_id, c.channel_name FROM account_channels ac "
        "JOIN channels c ON c.platform = ac.platform AND c.platform_id = ac.platform_id "
        "WHERE ac.account_id = ? ORDER BY ac.platform_id ASC",
        (account_id,),
    )
    assert [(row["platform_id"], row["channel_name"]) for row in rows] == [
        ("ch-2", "Beta"),
        ("ch-3", "Gamma"),
    ]

    orphan = await db.fetch_value("SELECT COUNT(*) FROM channels WHERE platform = 'discord' AND platform_id = 'ch-1'")
    assert int(orphan or 0) == 0


async def test_sync_account_channels_rolls_back_entire_replacement_on_failure(db, monkeypatch):
    account_id = new_id()
    now = utc_now_iso()
    await db.execute(
        "INSERT INTO accounts (id, platform, name, status, credentials, created_at, updated_at) "
        "VALUES (?, 'discord', 'Rollback Test', 'connected', '{}', ?, ?)",
        (account_id, now, now),
    )
    await sync_account_channels(db, account_id, "discord", [("old-1", "Old One"), ("old-2", "Old Two")])

    original_upsert = accounts_queries.upsert_channel
    calls = 0

    async def fail_second_upsert(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise RuntimeError("injected channel write failure")
        return await original_upsert(*args, **kwargs)

    monkeypatch.setattr(accounts_queries, "upsert_channel", fail_second_upsert)
    with pytest.raises(RuntimeError, match="injected channel write failure"):
        await sync_account_channels(db, account_id, "discord", [("new-1", "New One"), ("new-2", "New Two")])

    rows = await db.fetch_all(
        "SELECT platform_id FROM account_channels WHERE account_id = ? ORDER BY platform_id",
        (account_id,),
    )
    assert [row["platform_id"] for row in rows] == ["old-1", "old-2"]
    assert int(await db.fetch_value("SELECT COUNT(*) FROM channels WHERE platform_id LIKE 'new-%'") or 0) == 0


async def test_finalize_source_account_compensates_post_connect_failure(app, monkeypatch):
    account_id = new_id()
    now = utc_now_iso()
    await app.state.db.execute(
        "INSERT INTO accounts (id, platform, name, status, credentials, created_at, updated_at) "
        "VALUES (?, 'rss', 'Finalize Test', 'disconnected', '{}', ?, ?)",
        (account_id, now, now),
    )

    class _Collector:
        def __init__(self) -> None:
            self.stopped: list[str] = []

        async def stop_adapter(self, stopped_account_id: str) -> None:
            self.stopped.append(stopped_account_id)

    collector = _Collector()
    monkeypatch.setattr(app.state, "collector", collector)
    request = Request({"type": "http", "app": app, "method": "POST", "path": "/"})

    async def fail_finalize() -> None:
        raise RuntimeError("post-connect DB failure")

    with pytest.raises(RuntimeError, match="post-connect DB failure"):
        await finalize_source_account(request, account_id, fail_finalize)

    assert collector.stopped == [account_id]
    row = await app.state.db.fetch_one("SELECT status, last_error FROM accounts WHERE id = ?", (account_id,))
    assert row is not None
    assert row["status"] == "error"
    assert row["last_error"] == "post-connect DB failure"

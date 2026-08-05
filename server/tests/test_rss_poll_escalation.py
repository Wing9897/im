"""RSS poll-loop consecutive failure escalation."""

from __future__ import annotations

import aiohttp
import pytest

from server.collector.rss import _MAX_POLL_FAILURES, RssAdapter
from server.db.database import Database
from server.sse import SseBroadcaster


@pytest.fixture
async def db(tmp_path):
    database = Database(str(tmp_path / "rss-escalation.db"))
    await database.connect()
    await database.ensure_schema()
    yield database
    await database.close()


@pytest.fixture
def broadcaster():
    return SseBroadcaster()


@pytest.mark.asyncio
async def test_rss_poll_escalates_after_consecutive_failures(db: Database, broadcaster: SseBroadcaster):
    await db.execute(
        "INSERT INTO sources (id, platform, name, status, credentials, created_at, updated_at) "
        "VALUES ('acc-rss', 'rss', 'Feed', 'connected', '{}', '2026-07-01T00:00:00+00:00', "
        "'2026-07-01T00:00:00+00:00')",
    )
    events: list[tuple[str, dict]] = []
    broadcaster.publish = lambda event, payload: events.append((event, payload))  # type: ignore[method-assign]

    adapter = RssAdapter("acc-rss", db, broadcaster, "https://example.com/feed.xml", poll_interval=0.01)
    adapter._mark_connected()

    # Drive N failures without sleeping by calling the failure helper directly.
    for _ in range(_MAX_POLL_FAILURES - 1):
        await adapter._record_poll_failure("HTTP", aiohttp.ClientError("boom"))
        assert adapter.state.status == "connected"

    await adapter._record_poll_failure("HTTP", aiohttp.ClientError("boom"))
    assert adapter.state.status == "error"
    row = await db.fetch_one("SELECT status, last_error FROM sources WHERE id = 'acc-rss'")
    assert row is not None
    assert row["status"] == "error"
    assert row["last_error"]
    assert any(event == "source_status_changed" and payload.get("status") == "error" for event, payload in events)

    # Successful poll recovers.
    await adapter._record_poll_success()
    assert adapter.state.status == "connected"
    assert adapter._poll_failures == 0
    row = await db.fetch_one("SELECT status FROM sources WHERE id = 'acc-rss'")
    assert row is not None
    assert row["status"] == "connected"

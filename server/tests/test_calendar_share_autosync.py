"""Published workset autosync: dirty flag, 60s scan, hash skip, failures."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from server.calendar.user_events_write import create_user_event
from server.calendar_share.auto_sync_config import (
    AUTO_SYNC_INTERVAL_FLOOR_SECONDS,
    LOOP_TICK_SECONDS,
    SCAN_INTERVAL_SECONDS,
    WRITE_SPACING_SECONDS,
)
from server.calendar_share.autosync import (
    _pending_since,
    auto_sync_interval_elapsed,
    reset_auto_sync_pending_since_for_tests,
    sync_dirty_published_worksets,
)
from server.calendar_share.dirty import has_live_public_replica, mark_published_workset_dirty
from server.calendar_share.store import get_workset_entry, load_workset_map
from server.db.database import TransactionDb
from server.queries.worksets_queries import insert_workset
from server.tests.calendar_share_fakes import login_calendar_share
from server.util import utc_now_iso
from server.worksets_const import SYSTEM_WORKSET_ID


@pytest.fixture(autouse=True)
def _reset_auto_sync_pending_since():
    reset_auto_sync_pending_since_for_tests()
    yield
    reset_auto_sync_pending_since_for_tests()


async def _sync_due(
    db,
    *,
    spacing_seconds: float = 0,
    advance_seconds: float = AUTO_SYNC_INTERVAL_FLOOR_SECONDS + 1,
    sleep=None,
):
    marked_at = datetime.now(UTC)
    now = marked_at + timedelta(seconds=advance_seconds)
    mapping = await load_workset_map(db)
    for workset_id, entry in mapping.items():
        if entry.get("pendingSync") and entry.get("autoSync", True):
            _pending_since[str(workset_id)] = marked_at
    kwargs = {"spacing_seconds": spacing_seconds, "now": now}
    if sleep is not None:
        kwargs["sleep"] = sleep
    return await sync_dirty_published_worksets(db, **kwargs)


def _ic_writes(fake_remote) -> list[dict]:
    return [
        call
        for call in fake_remote.calls
        if str(call["path"]).startswith("/me/calendars/") and call["method"] in {"PUT", "PATCH"}
    ]


async def _publish(client, workset_id: str = SYSTEM_WORKSET_ID, slug: str = "Work") -> None:
    resp = await client.put(
        f"/api/v1/calendar-share/publish/{workset_id}",
        json={"slug": slug, "syncNow": True, "publicVisibility": "public"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "enabled" not in body
    assert body.get("pendingSync") is False


async def test_event_write_marks_published_workset_dirty(client, app, fake_remote):
    await login_calendar_share(client, fake_remote)
    await _publish(client)
    fake_remote.calls.clear()

    await create_user_event(
        app.state.db,
        title="Dirty one",
        start_time="2026-09-01T09:00:00",
        workset_id=SYSTEM_WORKSET_ID,
    )
    entry = await get_workset_entry(app.state.db, SYSTEM_WORKSET_ID)
    assert entry["pendingSync"] is True
    assert has_live_public_replica(entry)
    assert _ic_writes(fake_remote) == []


async def test_event_write_does_not_mark_unpublished_workset(client, app, fake_remote):
    await login_calendar_share(client, fake_remote)
    now = utc_now_iso()
    async with app.state.db.transaction() as conn:
        await insert_workset(TransactionDb(conn), workset_id="ws-local", name="Local", now=now)

    await create_user_event(
        app.state.db,
        title="Private",
        start_time="2026-09-01T09:00:00",
        workset_id="ws-local",
    )
    entry = await get_workset_entry(app.state.db, "ws-local")
    assert not entry.get("slug")
    assert "enabled" not in entry
    assert entry["pendingSync"] is False
    await sync_dirty_published_worksets(app.state.db, spacing_seconds=0)
    assert _ic_writes(fake_remote) == []


async def test_mapping_without_sync_now_does_not_auto_create(client, app, fake_remote):
    await login_calendar_share(client, fake_remote)
    resp = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"slug": "Work", "syncNow": False, "publicVisibility": "public"},
    )
    assert resp.status_code == 200, resp.text
    fake_remote.calls.clear()
    await create_user_event(
        app.state.db,
        title="Should not publish",
        start_time="2026-09-01T09:00:00",
        workset_id=SYSTEM_WORKSET_ID,
    )
    entry = await get_workset_entry(app.state.db, SYSTEM_WORKSET_ID)
    assert entry["pendingSync"] is False
    await sync_dirty_published_worksets(app.state.db, spacing_seconds=0)
    assert _ic_writes(fake_remote) == []


async def test_scan_pushes_once_for_two_edits(client, app, fake_remote):
    await login_calendar_share(client, fake_remote)
    await _publish(client)
    fake_remote.calls.clear()

    await create_user_event(
        app.state.db,
        title="Edit A",
        start_time="2026-09-01T09:00:00",
        workset_id=SYSTEM_WORKSET_ID,
    )
    await create_user_event(
        app.state.db,
        title="Edit B",
        start_time="2026-09-01T10:00:00",
        workset_id=SYSTEM_WORKSET_ID,
    )
    assert (await get_workset_entry(app.state.db, SYSTEM_WORKSET_ID))["pendingSync"] is True

    synced = await _sync_due(app.state.db)
    assert synced == [SYSTEM_WORKSET_ID]
    writes = _ic_writes(fake_remote)
    assert len(writes) == 1
    assert writes[0]["method"] == "PATCH"
    assert str(writes[0]["path"]).endswith("/changes")
    entry = await get_workset_entry(app.state.db, SYSTEM_WORKSET_ID)
    assert entry["pendingSync"] is False
    assert entry["lastError"] is None


async def test_scan_skips_hash_unchanged(client, app, fake_remote):
    await login_calendar_share(client, fake_remote)
    await _publish(client)
    fake_remote.calls.clear()

    await mark_published_workset_dirty(app.state.db, SYSTEM_WORKSET_ID)
    assert (await get_workset_entry(app.state.db, SYSTEM_WORKSET_ID))["pendingSync"] is True

    synced = await _sync_due(app.state.db)
    assert synced == [SYSTEM_WORKSET_ID]
    assert _ic_writes(fake_remote) == []
    entry = await get_workset_entry(app.state.db, SYSTEM_WORKSET_ID)
    assert entry["pendingSync"] is False
    assert entry["lastError"] is None


async def test_scan_failure_keeps_dirty(client, app, fake_remote):
    await login_calendar_share(client, fake_remote)
    await _publish(client)
    await create_user_event(
        app.state.db,
        title="Will fail",
        start_time="2026-09-01T09:00:00",
        workset_id=SYSTEM_WORKSET_ID,
    )
    fake_remote.calls.clear()
    fake_remote.patch_changes_status = 502
    fake_remote.put_calendar_status = 502

    synced = await _sync_due(app.state.db)
    assert synced == []
    entry = await get_workset_entry(app.state.db, SYSTEM_WORKSET_ID)
    assert entry["pendingSync"] is True
    assert entry["lastError"]


async def test_offline_keeps_dirty_without_ic_write(client, app, fake_remote):
    await login_calendar_share(client, fake_remote)
    await _publish(client)
    await create_user_event(
        app.state.db,
        title="Offline",
        start_time="2026-09-01T09:00:00",
        workset_id=SYSTEM_WORKSET_ID,
    )
    from server.calendar_share.store import clear_tokens

    await clear_tokens(app.state.db)
    fake_remote.calls.clear()
    synced = await _sync_due(app.state.db)
    assert synced == []
    assert _ic_writes(fake_remote) == []
    entry = await get_workset_entry(app.state.db, SYSTEM_WORKSET_ID)
    assert entry["pendingSync"] is True
    assert entry["lastError"] == "AUTH_REQUIRED"


async def test_manual_sync_clears_dirty(client, app, fake_remote):
    await login_calendar_share(client, fake_remote)
    await _publish(client)
    await create_user_event(
        app.state.db,
        title="Manual",
        start_time="2026-09-01T09:00:00",
        workset_id=SYSTEM_WORKSET_ID,
    )
    assert (await get_workset_entry(app.state.db, SYSTEM_WORKSET_ID))["pendingSync"] is True
    fake_remote.calls.clear()
    resp = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"slug": "Work", "syncNow": True, "publicVisibility": "public"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["pendingSync"] is False
    entry = await get_workset_entry(app.state.db, SYSTEM_WORKSET_ID)
    assert entry["pendingSync"] is False
    assert len(_ic_writes(fake_remote)) == 1


async def test_scan_serializes_worksets_with_write_spacing(client, app, fake_remote):
    await login_calendar_share(client, fake_remote)
    now = utc_now_iso()
    async with app.state.db.transaction() as conn:
        await insert_workset(TransactionDb(conn), workset_id="ws-other", name="Other", now=now)
    await _publish(client, SYSTEM_WORKSET_ID, "Work")
    await _publish(client, "ws-other", "OtherCal")
    await create_user_event(
        app.state.db,
        title="A",
        start_time="2026-09-01T09:00:00",
        workset_id=SYSTEM_WORKSET_ID,
    )
    await create_user_event(
        app.state.db,
        title="B",
        start_time="2026-09-01T10:00:00",
        workset_id="ws-other",
    )
    slept: list[float] = []

    async def fake_sleep(seconds: float) -> None:
        slept.append(seconds)

    fake_remote.calls.clear()
    synced = await _sync_due(
        app.state.db,
        spacing_seconds=WRITE_SPACING_SECONDS,
        sleep=fake_sleep,
    )
    assert set(synced) == {SYSTEM_WORKSET_ID, "ws-other"}
    assert slept == [WRITE_SPACING_SECONDS]
    assert SCAN_INTERVAL_SECONDS == 60.0
    assert WRITE_SPACING_SECONDS == 10.0
    assert LOOP_TICK_SECONDS == 10.0
    assert AUTO_SYNC_INTERVAL_FLOOR_SECONDS == 60
    assert len(_ic_writes(fake_remote)) == 2


async def test_autosync_skips_when_auto_sync_disabled(client, app, fake_remote):
    await login_calendar_share(client, fake_remote)
    await _publish(client)
    resp = await client.patch(
        "/api/v1/calendar-share/publish/auto-sync",
        json={"autoSync": False},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["autoSync"] is False
    entry = await get_workset_entry(app.state.db, SYSTEM_WORKSET_ID)
    assert entry["pendingSync"] is False
    fake_remote.calls.clear()

    await create_user_event(
        app.state.db,
        title="No auto",
        start_time="2026-09-01T09:00:00",
        workset_id=SYSTEM_WORKSET_ID,
    )
    entry = await get_workset_entry(app.state.db, SYSTEM_WORKSET_ID)
    assert entry["pendingSync"] is False
    synced = await sync_dirty_published_worksets(app.state.db, spacing_seconds=0)
    assert synced == []
    assert _ic_writes(fake_remote) == []


async def test_autosync_respects_household_interval(client, app, fake_remote):
    await login_calendar_share(client, fake_remote)
    await _publish(client)
    resp = await client.patch(
        "/api/v1/calendar-share/publish/auto-sync",
        json={"autoSync": True, "autoSyncIntervalSeconds": 300},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["autoSyncIntervalSeconds"] == 300
    entry = await get_workset_entry(app.state.db, SYSTEM_WORKSET_ID)
    base = datetime.now(UTC)
    from server.calendar_share.store import upsert_workset_entry

    await upsert_workset_entry(
        app.state.db,
        SYSTEM_WORKSET_ID,
        {**entry, "pendingSync": True},
    )
    fake_remote.calls.clear()
    _pending_since[SYSTEM_WORKSET_ID] = base
    synced = await sync_dirty_published_worksets(
        app.state.db,
        spacing_seconds=0,
        now=base + timedelta(seconds=30),
    )
    assert synced == []
    assert _ic_writes(fake_remote) == []

    synced = await sync_dirty_published_worksets(
        app.state.db,
        spacing_seconds=0,
        now=base + timedelta(seconds=330),
    )
    assert synced == [SYSTEM_WORKSET_ID]
    entry = await get_workset_entry(app.state.db, SYSTEM_WORKSET_ID)
    assert entry["pendingSync"] is False


async def test_patch_auto_sync_rejects_interval_below_floor(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    await _publish(client)
    resp = await client.patch(
        "/api/v1/calendar-share/publish/auto-sync",
        json={"autoSyncIntervalSeconds": 30},
    )
    assert resp.status_code == 422
    assert "60" in resp.text


def test_auto_sync_interval_elapsed_uses_floor():
    base = datetime(2026, 1, 1, 0, 0, 0, tzinfo=UTC)
    entry = {
        "autoSync": True,
        "autoSyncIntervalSeconds": 30,
        "pendingSync": True,
    }
    _pending_since["ws-a"] = base
    assert auto_sync_interval_elapsed(entry, workset_id="ws-a", now=base + timedelta(seconds=30)) is False
    _pending_since["ws-b"] = base
    assert auto_sync_interval_elapsed(entry, workset_id="ws-b", now=base + timedelta(seconds=61)) is True


async def test_unpublished_dirty_flag_is_not_scanned(client, app, fake_remote):
    from server.calendar_share.store import delete_workset_entry

    await login_calendar_share(client, fake_remote)
    await _publish(client)
    await delete_workset_entry(app.state.db, SYSTEM_WORKSET_ID)
    fake_remote.calls.clear()
    synced = await sync_dirty_published_worksets(app.state.db, spacing_seconds=0)
    assert synced == []
    assert _ic_writes(fake_remote) == []
    assert not any(call["method"] == "DELETE" for call in fake_remote.calls)


def test_clean_workset_entry_persists_pending_sync():
    from server.calendar_share.store import _clean_workset_entry, empty_workset_entry

    empty = empty_workset_entry("ws")
    assert empty["pendingSync"] is False
    cleaned = _clean_workset_entry("ws", {"slug": "Work", "pendingSync": True})
    assert cleaned is not None
    assert cleaned["pendingSync"] is True


def test_has_live_public_replica_ignores_last_sync_without_checkpoint():
    """lastSyncAt is also set on unpublish; it must not auto-create a remote calendar."""
    stale = {
        "slug": "general",
        "lastSyncAt": "2026-08-27T12:21:16Z",
        "lastServerEventsHash": None,
        "lastPublicVisibility": None,
    }
    assert not has_live_public_replica(stale)
    assert has_live_public_replica({**stale, "lastPublicVisibility": "public"})
    assert has_live_public_replica({**stale, "lastServerEventsHash": "abc"})

"""Calendar-share unpublish: DELETE remote calendar and drop the local SQL row."""

from __future__ import annotations

from server.tests.calendar_share_fakes import login_calendar_share
from server.worksets_const import SYSTEM_WORKSET_ID


async def test_unpublish_deletes_remote_calendar(client, app, fake_remote):
    await login_calendar_share(client, fake_remote)
    first = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"slug": "Work", "syncNow": True, "publicVisibility": "public"},
    )
    assert first.status_code == 200, first.text
    fake_remote.calls.clear()
    resp = await client.delete(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
    )
    assert resp.status_code == 200, resp.text
    assert "enabled" not in resp.json()
    calendar_delete = next(
        call for call in fake_remote.calls if call["path"] == "/me/calendars/Work" and call["method"] == "DELETE"
    )
    assert calendar_delete["json_body"] is None
    assert not any(call["path"] == "/me/calendars/Work" and call["method"] == "PUT" for call in fake_remote.calls)
    assert not any(str(call["path"]).endswith("/grants") for call in fake_remote.calls)

    from server.calendar_share.store import get_workset_entry

    entry = await get_workset_entry(app.state.db, SYSTEM_WORKSET_ID)
    assert entry["lastFingerprints"] == {"events": {}, "series": {}}
    assert entry["lastServerEventsHash"] is None
    assert entry["lastPublicVisibility"] is None
    assert entry["lastGrantsHash"] is None

    fake_remote.calls.clear()
    again = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"slug": "Work", "syncNow": True, "publicVisibility": "public"},
    )
    assert again.status_code == 200, again.text
    assert any(call["path"] == "/me/calendars/Work" and call["method"] == "PUT" for call in fake_remote.calls)
    assert not any(str(call["path"]).endswith("/changes") for call in fake_remote.calls)


async def test_unpublish_delete_404_is_idempotent(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    first = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"slug": "Work", "syncNow": True, "publicVisibility": "public"},
    )
    assert first.status_code == 200, first.text
    fake_remote.delete_calendar_status = 404
    fake_remote.calls.clear()
    resp = await client.delete(f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}")
    assert resp.status_code == 200, resp.text
    assert any(call["path"] == "/me/calendars/Work" and call["method"] == "DELETE" for call in fake_remote.calls)


async def test_delete_unpublish_always_deletes_remote(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    first = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"slug": "Work", "syncNow": True, "publicVisibility": "public"},
    )
    assert first.status_code == 200, first.text
    fake_remote.calls.clear()
    resp = await client.delete(f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}")
    assert resp.status_code == 200, resp.text
    assert any(call["path"] == "/me/calendars/Work" and call["method"] == "DELETE" for call in fake_remote.calls)


async def test_list_publish_includes_deleted_workset_orphan(client, app, fake_remote):
    from server.db.database import TransactionDb
    from server.queries.worksets_queries import insert_workset
    from server.util import utc_now_iso

    now = utc_now_iso()
    async with app.state.db.transaction() as conn:
        await insert_workset(TransactionDb(conn), workset_id="ws-gone", name="Gone WS", now=now)
    await login_calendar_share(client, fake_remote)
    published = await client.put(
        "/api/v1/calendar-share/publish/ws-gone",
        json={"slug": "Orphan", "syncNow": True, "publicVisibility": "public_busy"},
    )
    assert published.status_code == 200, published.text
    deleted = await client.delete("/api/v1/worksets/ws-gone")
    assert deleted.status_code == 200, deleted.text
    assert not any(
        str(call["path"]).startswith("/me/calendars/") and call["method"] == "DELETE" for call in fake_remote.calls
    )

    listed = await client.get("/api/v1/calendar-share/publish")
    assert listed.status_code == 200, listed.text
    items = listed.json()["items"]
    orphan = next(row for row in items if row["worksetId"] == "ws-gone")
    assert "enabled" not in orphan
    assert orphan["slug"] == "Orphan"
    assert orphan["publicVisibility"] == "public_busy"
    assert orphan["worksetMissing"] is True
    assert orphan["worksetName"] == ""

    still = await client.get("/api/v1/calendar-share/publish/ws-gone")
    assert still.status_code == 200, still.text
    assert "enabled" not in still.json()
    assert still.json()["slug"] == "Orphan"


async def test_unpublish_orphan_deletes_remote_not_workset(client, app, fake_remote):
    from server.db.database import TransactionDb
    from server.queries.worksets_queries import fetch_workset_row, insert_workset
    from server.util import utc_now_iso

    now = utc_now_iso()
    async with app.state.db.transaction() as conn:
        await insert_workset(TransactionDb(conn), workset_id="ws-gone", name="Gone WS", now=now)
    await login_calendar_share(client, fake_remote)
    published = await client.put(
        "/api/v1/calendar-share/publish/ws-gone",
        json={"slug": "Orphan", "syncNow": True, "publicVisibility": "public"},
    )
    assert published.status_code == 200, published.text
    deleted = await client.delete("/api/v1/worksets/ws-gone")
    assert deleted.status_code == 200, deleted.text
    fake_remote.calls.clear()

    republish = await client.put(
        "/api/v1/calendar-share/publish/ws-gone",
        json={"slug": "Orphan", "syncNow": True, "publicVisibility": "public"},
    )
    assert republish.status_code == 422

    resp = await client.delete("/api/v1/calendar-share/publish/ws-gone")
    assert resp.status_code == 200, resp.text
    assert "enabled" not in resp.json()
    assert any(call["path"] == "/me/calendars/Orphan" and call["method"] == "DELETE" for call in fake_remote.calls)
    assert await fetch_workset_row(app.state.db, "ws-gone") is None

    listed = await client.get("/api/v1/calendar-share/publish")
    assert all(row["worksetId"] != "ws-gone" for row in listed.json()["items"])

"""Calendar-share HTTP publish: snapshot PUT/PATCH, grants, and catalog."""

from __future__ import annotations

from server.errors import INVALID_CALENDAR_SLUG
from server.tests.calendar_share_fakes import login_calendar_share
from server.worksets_const import SYSTEM_WORKSET_ID


async def test_publish_puts_snapshot_and_grants(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    resp = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={
            "slug": "Work",
            "publicVisibility": "public_busy",
            "grants": [{"handle": "Alice", "visibility": "details"}],
            "syncNow": True,
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["slug"] == "Work"
    assert "enabled" not in body
    assert body["publicVisibility"] == "public_busy"
    assert body["grants"] == [{"handle": "Alice", "visibility": "details"}]
    assert body["lastSyncAt"]
    assert body["lastError"] is None
    calendar_put = next(call for call in fake_remote.calls if call["path"] == "/me/calendars/Work")
    assert calendar_put["json_body"]["publicVisibility"] == "public_busy"
    assert "visibility" not in calendar_put["json_body"]
    assert calendar_put["json_body"]["description"] == ""
    assert "emoji" not in calendar_put["json_body"]
    assert "events" in calendar_put["json_body"]
    series = calendar_put["json_body"]["series"]
    assert isinstance(series, list)
    weekly = next(row for row in series if row["uid"] == "task-cal")
    assert weekly["rrule"] == "FREQ=WEEKLY;BYDAY=MO"
    assert "T" in weekly["dtstart"]
    assert len(weekly["dtstart"]) > 5
    assert len(series) == len({row["uid"] for row in series})
    grants_put = next(call for call in fake_remote.calls if call["path"] == "/me/calendars/Work/grants")
    assert grants_put["json_body"] == {"grants": [{"handle": "Alice", "visibility": "details"}]}


async def test_publish_puts_analysis_and_item_remind(client, app, fake_remote):
    from server.calendar.item_projection import occurrence_id
    from server.calendar.timeline_dismissals import dismiss_timeline_event
    from server.calendar.user_events_write import create_user_event
    from server.db.database import TransactionDb
    from server.queries.worksets_queries import insert_workset
    from server.tests import seed
    from server.tests.items_helpers import seed_item_row
    from server.util import utc_now_iso

    now = utc_now_iso()
    async with app.state.db.transaction() as conn:
        await insert_workset(TransactionDb(conn), workset_id="ws-other", name="Other", now=now)
    await app.state.db.execute(
        "UPDATE analysis_tasks SET workset_id = ? WHERE id = ?",
        ("ws-other", seed.TASK_WEB_INTEL),
    )

    item_id = await seed_item_row(app.state.db, title="Passport", workset_id=SYSTEM_WORKSET_ID)
    await create_user_event(
        app.state.db,
        title="到期",
        start_time="2027-06-01T00:00:00",
        is_all_day=True,
        item_id=item_id,
        kind="expires",
        remind_before_days=7,
        workset_id=SYSTEM_WORKSET_ID,
    )
    remind_uid = occurrence_id(item_id, "remind")

    await login_calendar_share(client, fake_remote)
    resp = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"slug": "Work", "syncNow": True, "publicVisibility": "public"},
    )
    assert resp.status_code == 200, resp.text
    calendar_put = next(call for call in fake_remote.calls if call["path"] == "/me/calendars/Work")
    events = calendar_put["json_body"]["events"]
    series = calendar_put["json_body"]["series"]
    uids = {row["uid"] for row in events}
    assert "ev-1" in uids
    intel = next(row for row in events if row["uid"] == "ev-1")
    assert intel["title"] == "季度會議"
    assert str(intel["start"]).startswith("2026-07-15")
    assert intel["location"] == "台北"
    assert "taskId" not in intel
    assert "itemId" not in intel
    assert "kind" not in intel
    assert "notifyPref" not in intel
    assert "emoji" not in intel
    assert "dismissed" not in intel
    assert remind_uid in uids
    remind = next(row for row in events if row["uid"] == remind_uid)
    assert remind["title"] == "Passport"
    assert remind["start"] == "2027-05-25T00:00:00"
    assert remind["end"] == "2027-05-25T23:59:59"
    assert remind["allDay"] is True
    assert "itemId" not in remind
    assert "wi-1" not in uids
    weekly = next(row for row in series if row["uid"] == "task-cal")
    assert weekly["rrule"] == "FREQ=WEEKLY;BYDAY=MO"
    assert "timezone" in weekly
    assert "timezoneIcal" in weekly
    assert not any(str(row["uid"]).startswith("task-cal:") for row in events)

    await dismiss_timeline_event(app.state.db, source="analysis", event_id="ev-1")
    await dismiss_timeline_event(app.state.db, source="item_remind", event_id=remind_uid)
    fake_remote.calls.clear()
    again = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"slug": "Work", "syncNow": True, "publicVisibility": "public"},
    )
    assert again.status_code == 200, again.text
    second = next(call for call in fake_remote.calls if str(call["path"]).endswith("/changes"))
    assert second["method"] == "PATCH"
    assert second["json_body"]["baseHash"] == "srv-hash-1"
    deleted = set(second["json_body"]["deleteEventUids"])
    assert "ev-1" in deleted
    assert remind_uid in deleted
    upsert_uids = {row["uid"] for row in second["json_body"]["upsertEvents"]}
    assert "ev-1" not in upsert_uids
    assert remind_uid not in upsert_uids
    assert "ben-1" not in upsert_uids
    assert second["json_body"]["deleteSeriesUids"] == []
    assert not any(row["uid"] == "task-cal" for row in second["json_body"]["upsertSeries"])


async def test_publish_refresh_on_401(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    fake_remote.fail_first_authorized = True
    resp = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"slug": "Work", "syncNow": True, "publicVisibility": "private_group"},
    )
    assert resp.status_code == 200, resp.text
    assert any(call["path"] == "/auth/refresh" for call in fake_remote.calls)
    calendar_puts = [call for call in fake_remote.calls if call["path"] == "/me/calendars/Work"]
    assert len(calendar_puts) >= 2
    assert calendar_puts[-1]["access_token"] == "acc-2"


async def test_publish_second_sync_skips_unchanged_fingerprints(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    body = {
        "slug": "Work",
        "publicVisibility": "private_group",
        "grants": [],
        "syncNow": True,
    }
    first = await client.put(f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}", json=body)
    assert first.status_code == 200, first.text
    fake_remote.calls.clear()
    second = await client.put(f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}", json=body)
    assert second.status_code == 200, second.text
    assert not any(call["path"] == "/me/calendars/Work" for call in fake_remote.calls)
    assert not any(str(call["path"]).endswith("/grants") for call in fake_remote.calls)


async def test_publish_visibility_change_patches_without_event_diff(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    first = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"slug": "Work", "syncNow": True, "publicVisibility": "public"},
    )
    assert first.status_code == 200, first.text
    fake_remote.calls.clear()
    again = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"slug": "Work", "syncNow": True, "publicVisibility": "public_busy"},
    )
    assert again.status_code == 200, again.text
    patch = next(call for call in fake_remote.calls if str(call["path"]).endswith("/changes"))
    assert patch["method"] == "PATCH"
    assert patch["json_body"]["baseHash"] == "srv-hash-1"
    assert patch["json_body"]["publicVisibility"] == "public_busy"
    assert patch["json_body"]["upsertEvents"] == []
    assert patch["json_body"]["deleteEventUids"] == []
    assert not any(call["path"] == "/me/calendars/Work" and call["method"] == "PUT" for call in fake_remote.calls)


async def test_publish_incremental_409_falls_back_to_full_put(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    first = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"slug": "Work", "syncNow": True, "publicVisibility": "public"},
    )
    assert first.status_code == 200, first.text
    fake_remote.patch_changes_status = 409
    fake_remote.calls.clear()
    again = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"slug": "Work", "syncNow": True, "publicVisibility": "public_busy"},
    )
    assert again.status_code == 200, again.text
    assert any(str(call["path"]).endswith("/changes") for call in fake_remote.calls)
    fallback = next(
        call for call in fake_remote.calls if call["path"] == "/me/calendars/Work" and call["method"] == "PUT"
    )
    assert "events" in fallback["json_body"]
    assert "series" in fallback["json_body"]


async def test_publish_without_sync_now_does_not_push(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    resp = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={
            "slug": "Work",
            "syncNow": False,
            "publicVisibility": "public",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "enabled" not in body
    assert body["autoSync"] is True
    assert body["autoSyncIntervalSeconds"] == 60
    assert not any(call["path"] == "/me/calendars/Work" for call in fake_remote.calls)


async def test_publish_copies_workset_description_and_cover(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    cover = "data:image/jpeg;base64,cover123"
    updated = await client.put(
        f"/api/v1/worksets/{SYSTEM_WORKSET_ID}",
        json={"description": "Household ops", "cover": cover},
    )
    assert updated.status_code == 200, updated.text
    resp = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"slug": "Work", "syncNow": True, "publicVisibility": "public"},
    )
    assert resp.status_code == 200, resp.text
    calendar_put = next(call for call in fake_remote.calls if call["path"] == "/me/calendars/Work")
    assert calendar_put["json_body"]["description"] == "Household ops"
    assert calendar_put["json_body"]["cover"] == cover
    assert "emoji" not in calendar_put["json_body"]
    listed = await client.get("/api/v1/calendar-share/publish")
    row = next(item for item in listed.json()["items"] if item["worksetId"] == SYSTEM_WORKSET_ID)
    assert row["description"] == "Household ops"
    assert row["cover"] == cover


async def test_publish_catalog_change_patches_without_event_diff(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    first = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"slug": "Work", "syncNow": True, "publicVisibility": "public"},
    )
    assert first.status_code == 200, first.text
    updated = await client.put(
        f"/api/v1/worksets/{SYSTEM_WORKSET_ID}",
        json={"description": "Busy board"},
    )
    assert updated.status_code == 200, updated.text
    fake_remote.calls.clear()
    again = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"slug": "Work", "syncNow": True, "publicVisibility": "public"},
    )
    assert again.status_code == 200, again.text
    patch = next(call for call in fake_remote.calls if str(call["path"]).endswith("/changes"))
    assert patch["method"] == "PATCH"
    assert patch["json_body"]["description"] == "Busy board"
    assert "emoji" not in patch["json_body"]
    assert patch["json_body"]["upsertEvents"] == []
    assert patch["json_body"]["deleteEventUids"] == []
    assert not any(call["path"] == "/me/calendars/Work" and call["method"] == "PUT" for call in fake_remote.calls)


async def test_publish_skips_catalog_when_last_cover_unchanged(client, app, fake_remote):
    """skip_catalog: unchanged events + lastCover/lastDescription skip remote; cover change patches."""
    from server.calendar_share.store import get_workset_entry

    await login_calendar_share(client, fake_remote)
    cover = "data:image/jpeg;base64,cover-v1"
    updated = await client.put(
        f"/api/v1/worksets/{SYSTEM_WORKSET_ID}",
        json={"description": "Ops board", "cover": cover},
    )
    assert updated.status_code == 200, updated.text
    first = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"slug": "Work", "syncNow": True, "publicVisibility": "public"},
    )
    assert first.status_code == 200, first.text
    calendar_put = next(call for call in fake_remote.calls if call["path"] == "/me/calendars/Work")
    assert calendar_put["json_body"]["description"] == "Ops board"
    assert calendar_put["json_body"]["cover"] == cover
    entry = await get_workset_entry(app.state.db, SYSTEM_WORKSET_ID)
    assert entry["lastDescription"] == "Ops board"
    assert entry["lastCover"] == cover

    fake_remote.calls.clear()
    unchanged = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"slug": "Work", "syncNow": True, "publicVisibility": "public"},
    )
    assert unchanged.status_code == 200, unchanged.text
    assert not any(
        call["path"] == "/me/calendars/Work" or str(call["path"]).endswith("/changes") for call in fake_remote.calls
    )

    new_cover = "data:image/jpeg;base64,cover-v2"
    workset_update = await client.put(
        f"/api/v1/worksets/{SYSTEM_WORKSET_ID}",
        json={"cover": new_cover},
    )
    assert workset_update.status_code == 200, workset_update.text
    fake_remote.calls.clear()
    cover_sync = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"slug": "Work", "syncNow": True, "publicVisibility": "public"},
    )
    assert cover_sync.status_code == 200, cover_sync.text
    patch = next(call for call in fake_remote.calls if str(call["path"]).endswith("/changes"))
    assert patch["method"] == "PATCH"
    assert patch["json_body"]["cover"] == new_cover
    assert patch["json_body"]["description"] == "Ops board"
    assert patch["json_body"]["upsertEvents"] == []
    assert patch["json_body"]["deleteEventUids"] == []
    entry_again = await get_workset_entry(app.state.db, SYSTEM_WORKSET_ID)
    assert entry_again["lastCover"] == new_cover


async def test_publish_cover_change_patches_without_event_diff(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    first = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"slug": "Work", "syncNow": True, "publicVisibility": "public"},
    )
    assert first.status_code == 200, first.text
    cover = "data:image/jpeg;base64,newcover"
    updated = await client.put(
        f"/api/v1/worksets/{SYSTEM_WORKSET_ID}",
        json={"cover": cover},
    )
    assert updated.status_code == 200, updated.text
    fake_remote.calls.clear()
    again = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"slug": "Work", "syncNow": True, "publicVisibility": "public"},
    )
    assert again.status_code == 200, again.text
    patch = next(call for call in fake_remote.calls if str(call["path"]).endswith("/changes"))
    assert patch["method"] == "PATCH"
    assert patch["json_body"]["cover"] == cover
    assert patch["json_body"]["upsertEvents"] == []


async def test_publish_coerces_builtin_workset_id_to_general(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    resp = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"slug": SYSTEM_WORKSET_ID, "syncNow": True, "publicVisibility": "private_group"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["slug"] == "general"
    assert any(call["path"] == "/me/calendars/general" for call in fake_remote.calls)


async def test_publish_rejects_invalid_slugs(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    for slug in ("foo bar", "a/b"):
        resp = await client.put(
            f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
            json={"slug": slug, "syncNow": False, "publicVisibility": "private_group"},
        )
        assert resp.status_code == 422, resp.text
        body = resp.json()
        assert body["error_code"] == INVALID_CALENDAR_SLUG
    empty = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"slug": "", "syncNow": False, "publicVisibility": "private_group"},
    )
    assert empty.status_code == 422
    too_long = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"slug": "a" * 65, "syncNow": False, "publicVisibility": "private_group"},
    )
    assert too_long.status_code == 422


async def test_publish_succeeds_when_grants_fail_after_snapshot(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    fake_remote.put_grants_status = 500
    fake_remote.put_grants_payload = None
    resp = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={
            "slug": "general",
            "syncNow": True,
            "publicVisibility": "public",
            "grants": [{"handle": "Alice", "visibility": "details"}],
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "enabled" not in body
    assert body["slug"] == "general"
    assert body["lastError"] is None
    assert body["lastSyncAt"]
    assert any(call["path"] == "/me/calendars/general" and call["method"] == "PUT" for call in fake_remote.calls)
    assert any(str(call["path"]).endswith("/grants") for call in fake_remote.calls)
    listed = await client.get("/api/v1/calendar-share/publish")
    row = next(item for item in listed.json()["items"] if item["worksetId"] == SYSTEM_WORKSET_ID)
    assert "enabled" not in row
    assert row["slug"] == "general"


async def test_publish_timeout_then_write_interval_is_success(client, fake_remote):
    from server.calendar_share.remote import CalendarShareRemoteError

    await login_calendar_share(client, fake_remote)
    fake_remote.put_calendar_queue = [
        CalendarShareRemoteError(502, "Calendar share server unreachable"),
        (429, {"detail": "Too many calendar writes"}),
    ]
    resp = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"slug": "general", "syncNow": True, "publicVisibility": "public"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert "enabled" not in body
    assert body["lastError"] is None
    calendar_puts = [
        call for call in fake_remote.calls if call["path"] == "/me/calendars/general" and call["method"] == "PUT"
    ]
    assert len(calendar_puts) == 2


async def test_publish_still_fails_when_snapshot_write_fails(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    fake_remote.put_calendar_status = 500
    fake_remote.put_calendar_queue = [(500, None)]
    resp = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"slug": "general", "syncNow": True, "publicVisibility": "public"},
    )
    assert resp.status_code == 502
    body = resp.json()
    assert body["error_code"] == "CALENDAR_SHARE_REQUEST_FAILED"
    assert body["message"] == "CALENDAR_SHARE_REQUEST_FAILED"

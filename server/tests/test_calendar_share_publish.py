"""Calendar-share publish: snapshots, grants, incremental patch, fingerprints."""

from __future__ import annotations

from server.calendar_share.publish import snapshot_remote_events, snapshot_remote_series
from server.calendar_share.snapshot import diff_uid_maps, fingerprint_maps, snapshot_unchanged
from server.tests.calendar_share_fakes import login_calendar_share
from server.worksets_const import SYSTEM_WORKSET_ID


def test_snapshot_skips_dismissed_and_unknown_sources():
    events = snapshot_remote_events(
        [
            {
                "id": "gone",
                "source": "user",
                "title": "Hidden",
                "startTime": "2026-08-01T09:00:00Z",
                "dismissed": True,
            },
            {
                "id": "intel",
                "source": "analysis",
                "title": "Intel",
                "startTime": "2026-08-01T09:00:00Z",
                "body": "Brief",
                "location": "Taipei",
                "dismissed": False,
            },
            {
                "id": "intel-gone",
                "source": "analysis",
                "title": "Hidden intel",
                "startTime": "2026-08-01T10:00:00Z",
                "dismissed": True,
            },
            {
                "id": "item:badge:remind",
                "source": "item_remind",
                "title": "Badge",
                "startTime": "2026-12-25T00:00:00",
                "endTime": "2026-12-25T23:59:59",
                "isAllDay": True,
                "dismissed": False,
            },
            {
                "id": "item:old:remind",
                "source": "item_remind",
                "title": "Old",
                "startTime": "2026-12-01T00:00:00",
                "dismissed": True,
            },
            {
                "id": "task-cal:20260803T090000Z",
                "source": "recurring",
                "title": "Weekly",
                "startTime": "2026-08-03T09:00:00Z",
                "dismissed": False,
            },
            {
                "id": "keep",
                "source": "user",
                "title": "Standup",
                "startTime": "2026-08-01T09:00:00Z",
                "endTime": "2026-08-01T09:30:00Z",
                "location": "HQ",
                "body": "Notes",
                "isAllDay": False,
                "dismissed": False,
            },
        ]
    )
    assert [row["uid"] for row in events] == ["intel", "item:badge:remind", "keep"]
    assert events[0]["title"] == "Intel"
    assert events[0]["description"] == "Brief"
    assert events[0]["location"] == "Taipei"
    assert events[1]["allDay"] is True
    assert events[1]["start"] == "2026-12-25T00:00:00"
    assert events[2]["title"] == "Standup"
    assert events[2]["location"] == "HQ"
    assert events[2]["description"] == "Notes"
    for row in events:
        assert set(row) == {"uid", "start", "end", "title", "location", "description", "allDay"}


async def test_publish_puts_snapshot_and_grants(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    resp = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={
            "enabled": True,
            "slug": "Work",
            "autoSync": False,
            "publicVisibility": "busy",
            "grants": [{"handle": "Alice", "visibility": "details"}],
            "syncNow": True,
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["slug"] == "Work"
    assert body["enabled"] is True
    assert body["publicVisibility"] == "busy"
    assert body["grants"] == [{"handle": "Alice", "visibility": "details"}]
    assert body["lastSyncAt"]
    assert body["lastError"] is None
    calendar_put = next(call for call in fake_remote.calls if call["path"] == "/me/calendars/Work")
    assert calendar_put["json_body"]["publicVisibility"] == "busy"
    assert calendar_put["json_body"]["visibility"] == "busy"
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
        json={"enabled": True, "slug": "Work", "syncNow": True, "publicVisibility": "details"},
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
        json={"enabled": True, "slug": "Work", "syncNow": True, "publicVisibility": "details"},
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
        json={"enabled": True, "slug": "Work", "syncNow": True, "publicVisibility": "off"},
    )
    assert resp.status_code == 200, resp.text
    assert any(call["path"] == "/auth/refresh" for call in fake_remote.calls)
    calendar_puts = [call for call in fake_remote.calls if call["path"] == "/me/calendars/Work"]
    assert len(calendar_puts) >= 2
    assert calendar_puts[-1]["access_token"] == "acc-2"


async def test_publish_second_sync_skips_unchanged_fingerprints(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    body = {
        "enabled": True,
        "slug": "Work",
        "autoSync": False,
        "publicVisibility": "off",
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
        json={"enabled": True, "slug": "Work", "syncNow": True, "publicVisibility": "details"},
    )
    assert first.status_code == 200, first.text
    fake_remote.calls.clear()
    again = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"enabled": True, "slug": "Work", "syncNow": True, "publicVisibility": "busy"},
    )
    assert again.status_code == 200, again.text
    patch = next(call for call in fake_remote.calls if str(call["path"]).endswith("/changes"))
    assert patch["method"] == "PATCH"
    assert patch["json_body"]["baseHash"] == "srv-hash-1"
    assert patch["json_body"]["publicVisibility"] == "busy"
    assert patch["json_body"]["upsertEvents"] == []
    assert patch["json_body"]["deleteEventUids"] == []
    assert not any(call["path"] == "/me/calendars/Work" and call["method"] == "PUT" for call in fake_remote.calls)


async def test_publish_incremental_409_falls_back_to_full_put(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    first = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"enabled": True, "slug": "Work", "syncNow": True, "publicVisibility": "details"},
    )
    assert first.status_code == 200, first.text
    fake_remote.patch_changes_status = 409
    fake_remote.calls.clear()
    again = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"enabled": True, "slug": "Work", "syncNow": True, "publicVisibility": "busy"},
    )
    assert again.status_code == 200, again.text
    assert any(str(call["path"]).endswith("/changes") for call in fake_remote.calls)
    fallback = next(
        call for call in fake_remote.calls if call["path"] == "/me/calendars/Work" and call["method"] == "PUT"
    )
    assert "events" in fallback["json_body"]
    assert "series" in fallback["json_body"]


async def test_unpublish_sends_empty_events_and_series(client, fake_remote):
    await login_calendar_share(client, fake_remote)
    first = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"enabled": True, "slug": "Work", "syncNow": True, "publicVisibility": "details"},
    )
    assert first.status_code == 200, first.text
    fake_remote.calls.clear()
    resp = await client.put(
        f"/api/v1/calendar-share/publish/{SYSTEM_WORKSET_ID}",
        json={"enabled": False, "slug": "Work", "syncNow": True, "publicVisibility": "details"},
    )
    assert resp.status_code == 200, resp.text
    calendar_put = next(call for call in fake_remote.calls if call["path"] == "/me/calendars/Work")
    assert calendar_put["json_body"]["events"] == []
    assert calendar_put["json_body"]["series"] == []
    assert calendar_put["json_body"]["visibility"] == "details"


def test_fingerprint_changes_when_title_changes():
    event = {
        "uid": "a",
        "start": "2026-08-01T09:00:00Z",
        "end": "2026-08-01T10:00:00Z",
        "title": "A",
        "location": "",
        "description": "",
        "allDay": False,
    }
    first = fingerprint_maps([event], [])
    second = fingerprint_maps([{**event, "title": "B"}], [])
    assert first != second
    assert fingerprint_maps([event], []) == first
    assert snapshot_unchanged(first, fingerprint_maps([event]), "busy", "busy")
    assert not snapshot_unchanged(first, second, "busy", "busy")


def test_fingerprint_diff_add_update_delete():
    previous = {"keep": "aaa", "gone": "bbb", "edit": "old"}
    current = {"keep": "aaa", "edit": "new", "fresh": "ccc"}
    upsert, delete = diff_uid_maps(previous, current)
    assert upsert == ["edit", "fresh"]
    assert delete == ["gone"]


def test_fingerprint_maps_include_series_and_visibility_skip():
    event = {
        "uid": "a",
        "start": "2026-08-01T09:00:00Z",
        "end": "2026-08-01T10:00:00Z",
        "title": "A",
        "location": "",
        "description": "",
        "allDay": False,
    }
    series = {
        "uid": "s1",
        "name": "Standup",
        "rrule": "FREQ=WEEKLY;BYDAY=MO",
        "dtstart": "2026-08-03T09:00:00Z",
        "dtend": "2026-08-03T09:30:00Z",
        "isAllDay": False,
        "location": "",
        "description": "",
        "timezone": "UTC",
        "timezoneIcal": "",
        "exdatesJson": "[]",
        "rdatesJson": "[]",
        "isActive": True,
    }
    first = fingerprint_maps([event], [series])
    second = fingerprint_maps([event], [{**series, "name": "Other"}])
    assert first != second
    assert fingerprint_maps([event], [series]) == first
    assert snapshot_unchanged(first, first, "busy", "busy")
    assert not snapshot_unchanged(first, first, "busy", "details")
    assert not snapshot_unchanged(first, second, "busy", "busy")


def test_workset_entry_ignores_legacy_last_events_hash():
    from server.calendar_share.store import _clean_workset_entry

    cleaned = _clean_workset_entry(
        "ws",
        {
            "slug": "Work",
            "publicVisibility": "busy",
            "lastEventsHash": "legacy-local-aggregate",
            "lastServerEventsHash": "srv-hash",
            "lastPublicVisibility": "busy",
            "lastFingerprints": {"events": {"a": "fp"}, "series": {}},
        },
    )
    assert cleaned is not None
    assert "lastEventsHash" not in cleaned
    assert cleaned["lastServerEventsHash"] == "srv-hash"
    assert cleaned["lastPublicVisibility"] == "busy"
    assert cleaned["lastFingerprints"]["events"] == {"a": "fp"}


def test_snapshot_remote_series_stamps_account_tz_on_floating():
    rows = [
        {
            "id": "ser-1",
            "name": "Weekly",
            "rrule": "FREQ=WEEKLY;BYDAY=MO",
            "is_active": 1,
            "event_start_time": "2026-08-03T09:00:00",
            "event_end_time": "2026-08-03T09:30:00",
            "event_start_local": "2026-08-03T09:00:00",
            "event_end_local": "2026-08-03T09:30:00",
            "event_is_all_day": 0,
            "event_location": "HQ",
            "event_description": "Notes",
            "event_timezone": "floating",
            "event_timezone_ical": "BEGIN:VTIMEZONE",
            "event_exdates_json": "[]",
            "event_rdates_json": "[]",
        },
        {
            "id": "ser-ics",
            "name": "Imported",
            "rrule": "FREQ=WEEKLY;BYDAY=TU",
            "is_active": 1,
            "event_start_local": "2026-08-04T09:00:00",
            "event_start_time": "2026-08-04T09:00:00",
            "event_end_local": "2026-08-04T09:30:00",
            "event_timezone": "America/New_York",
            "event_timezone_ical": "BEGIN:VTIMEZONE\nTZID:America/New_York",
        },
        {
            "id": "ser-inactive",
            "name": "Paused",
            "rrule": "FREQ=WEEKLY;BYDAY=TU",
            "is_active": 0,
            "event_start_local": "2026-08-04T09:00:00",
            "event_start_time": "2026-08-04T09:00:00",
        },
    ]
    out = snapshot_remote_series(rows, calendar_timezone="Asia/Hong_Kong")
    assert [row["uid"] for row in out] == ["ser-1", "ser-ics"]
    assert out[0]["dtstart"] == "2026-08-03T09:00:00"
    assert out[0]["dtend"] == "2026-08-03T09:30:00"
    assert out[0]["timezone"] == "Asia/Hong_Kong"
    assert out[0]["timezoneIcal"] == "BEGIN:VTIMEZONE"
    assert out[0]["exdatesJson"] == "[]"
    assert out[1]["timezone"] == "America/New_York"
    assert out[1]["timezoneIcal"] == "BEGIN:VTIMEZONE\nTZID:America/New_York"

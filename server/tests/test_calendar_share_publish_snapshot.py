"""Calendar-share publish snapshots: event/series projection and fingerprints."""

from __future__ import annotations

from server.calendar_share.publish import snapshot_remote_events, snapshot_remote_series
from server.calendar_share.snapshot import diff_uid_maps, fingerprint_maps, snapshot_unchanged


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
            {
                "id": "instant",
                "source": "user",
                "title": "Ping",
                "startTime": "2026-08-01T12:00:00",
                "dismissed": False,
            },
        ]
    )
    assert [row["uid"] for row in events] == ["intel", "item:badge:remind", "keep", "instant"]
    assert events[0]["title"] == "Intel"
    assert events[0]["description"] == "Brief"
    assert events[0]["location"] == "Taipei"
    assert events[1]["allDay"] is True
    assert events[1]["start"] == "2026-12-25T00:00:00"
    assert events[2]["title"] == "Standup"
    assert events[2]["location"] == "HQ"
    assert events[2]["description"] == "Notes"
    assert events[3]["end"] == "2026-08-01T12:00:01"
    for row in events:
        assert set(row) == {"uid", "start", "end", "title", "location", "description", "allDay"}
        assert isinstance(row["location"], str)
        assert isinstance(row["description"], str)
        assert row["end"] != row["start"]


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
    assert snapshot_unchanged(first, fingerprint_maps([event]), "public_busy", "public_busy")
    assert not snapshot_unchanged(first, second, "public_busy", "public_busy")


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
    assert snapshot_unchanged(first, first, "public_busy", "public_busy")
    assert not snapshot_unchanged(first, first, "public_busy", "public")
    assert not snapshot_unchanged(first, second, "public_busy", "public_busy")


def test_workset_entry_ignores_legacy_last_events_hash():
    from server.calendar_share.store import _clean_workset_entry

    cleaned = _clean_workset_entry(
        "ws",
        {
            "slug": "Work",
            "publicVisibility": "public_busy",
            "lastEventsHash": "legacy-local-aggregate",
            "lastServerEventsHash": "srv-hash",
            "lastPublicVisibility": "busy",
            "lastFingerprints": {"events": {"a": "fp"}, "series": {}},
        },
    )
    assert cleaned is not None
    assert "lastEventsHash" not in cleaned
    assert cleaned["lastServerEventsHash"] == "srv-hash"
    assert cleaned["publicVisibility"] == "public_busy"
    assert cleaned["lastPublicVisibility"] == "public_busy"
    assert cleaned["lastFingerprints"]["events"] == {"a": "fp"}


def test_clean_workset_entry_maps_legacy_listing_visibility():
    from server.calendar_share.store import _clean_workset_entry

    mapping = {"off": "private_group", "details": "public", "busy": "public_busy"}
    for raw, want in mapping.items():
        cleaned = _clean_workset_entry(
            "ws",
            {"slug": "Work", "publicVisibility": raw, "lastPublicVisibility": raw},
        )
        assert cleaned is not None
        assert cleaned["publicVisibility"] == want
        assert cleaned["lastPublicVisibility"] == want
    canonical = _clean_workset_entry("ws", {"slug": "Work", "publicVisibility": "public"})
    assert canonical is not None
    assert canonical["publicVisibility"] == "public"


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

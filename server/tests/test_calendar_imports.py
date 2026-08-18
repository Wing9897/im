"""Focused parser, preview/commit, UID upsert, and recurrence tests."""

from __future__ import annotations

import aiosqlite
import pytest

from server.agent.tools_calendar import execute_calendar_tool
from server.calendar.ics import MAX_ICS_BYTES, IcsParseError, parse_ics
from server.calendar.imports import ImportSelection, commit_calendar_import
from server.calendar.query import query_window

ICS = """BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Intelligence Monitor Tests//EN
X-WR-CALNAME:Import matrix
BEGIN:VEVENT
UID:single-1@example.test
DTSTART:20260801T120000Z
DTEND:20260801T130000Z
SUMMARY:One\\, escaped event
DESCRIPTION:Line one\\nLine two
LOCATION:Room A
END:VEVENT
BEGIN:VEVENT
UID:series-1@example.test
DTSTART;TZID=Asia/Hong_Kong:20260803T090000
DTEND;TZID=Asia/Hong_Kong:20260803T100000
RRULE:FREQ=WEEKLY;COUNT=3
EXDATE;TZID=Asia/Hong_Kong:20260810T090000
RDATE;TZID=Asia/Hong_Kong:20260811T090000
SUMMARY:Weekly sync
END:VEVENT
BEGIN:VEVENT
UID:series-1@example.test
RECURRENCE-ID;TZID=Asia/Hong_Kong:20260810T090000
DTSTART;TZID=Asia/Hong_Kong:20260810T110000
DTEND;TZID=Asia/Hong_Kong:20260810T120000
SUMMARY:Moved occurrence
END:VEVENT
BEGIN:VEVENT
UID:all-day@example.test
DTSTART;VALUE=DATE:20260820
DTEND;VALUE=DATE:20260822
SUMMARY:Two day event
END:VEVENT
END:VCALENDAR
"""

ALL_DAY_SERIES_ICS = """BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:all-day-series@example.test
DTSTART;VALUE=DATE:20260801
DTEND;VALUE=DATE:20260802
RRULE:FREQ=DAILY;UNTIL=20260803
EXDATE;VALUE=DATE:20260802
RDATE;VALUE=DATE:20260804
SUMMARY:All day series
END:VEVENT
END:VCALENDAR
"""

CUSTOM_TIMEZONE_ICS = """BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VTIMEZONE
TZID:Custom/Office
BEGIN:STANDARD
DTSTART:19700101T000000
TZOFFSETFROM:+0800
TZOFFSETTO:+0800
TZNAME:OFFICE
END:STANDARD
END:VTIMEZONE
BEGIN:VEVENT
UID:custom-zone@example.test
DTSTART;TZID=Custom/Office:20260801T090000
DTEND;TZID=Custom/Office:20260801T100000
RRULE:FREQ=DAILY;COUNT=2
SUMMARY:Custom zone series
END:VEVENT
END:VCALENDAR
"""

GOOGLE_OUTLOOK_ICS = """BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Google Inc//Google Calendar 70.9054//EN
X-WR-CALNAME:Interop samples
BEGIN:VEVENT
UID:google-floating@example.test
DTSTART:20260805T093000
DTEND:20260805T101500
SUMMARY:Floating Google event
DESCRIPTION:A long description that is folded by the producer and must remain
 readable after RFC 5545 unfolding.
END:VEVENT
BEGIN:VEVENT
UID:outlook-all-day@example.test
DTSTART;VALUE=DATE:20260807
DTEND;VALUE=DATE:20260809
SUMMARY:Outlook all-day event
X-MICROSOFT-CDO-ALLDAYEVENT:TRUE
X-MICROSOFT-CDO-BUSYSTATUS:FREE
END:VEVENT
END:VCALENDAR
"""

# Holiday-style feeds often omit UID entirely; product must still import them.
NO_UID_ALL_DAY_ICS = """BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Taiwan Holidays Fixture//EN
X-WR-CALNAME:Taiwan Holidays
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260101
DTEND;VALUE=DATE:20260102
SUMMARY:元旦
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260217
DTEND;VALUE=DATE:20260218
SUMMARY:春節
LOCATION:Taiwan
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260405
DTEND;VALUE=DATE:20260406
SUMMARY:清明節
END:VEVENT
END:VCALENDAR
"""


def test_parser_handles_multiple_events_timezone_all_day_and_exceptions() -> None:
    parsed = parse_ics(ICS)
    assert parsed.calendar_name == "Import matrix"
    assert len(parsed.events) == 4

    single = parsed.events[0]
    assert single.title == "One, escaped event"
    assert single.description == "Line one\nLine two"
    assert single.start_time == "2026-08-01T12:00:00Z"

    series = parsed.events[1]
    assert series.timezone_id == "Asia/Hong_Kong"
    assert series.start_local == "2026-08-03T09:00:00"
    assert series.start_time == "2026-08-03T01:00:00Z"
    assert series.rrule == "FREQ=WEEKLY;COUNT=3"
    assert series.exdates == ("2026-08-10T01:00:00Z",)
    assert series.rdates == ("2026-08-11T01:00:00Z",)

    override = parsed.events[2]
    assert override.supported is False
    assert any(warning.code == "unsupported_recurrence_id" for warning in override.warnings)

    all_day = parsed.events[3]
    assert all_day.is_all_day is True
    assert all_day.start_local == "2026-08-20"
    assert all_day.end_local == "2026-08-22"


def test_parser_rejects_oversize_and_marks_duplicate_uid_unsupported() -> None:
    try:
        parse_ics(b" " * (MAX_ICS_BYTES + 1))
    except IcsParseError as exc:
        assert "exceeds" in str(exc)
    else:
        raise AssertionError("oversize input must fail")

    duplicate = ICS.replace("all-day@example.test", "single-1@example.test")
    parsed = parse_ics(duplicate)
    matching = [event for event in parsed.events if event.uid == "single-1@example.test"]
    assert len(matching) == 2
    assert all(not event.supported for event in matching)
    assert all(any(warning.code == "duplicate_uid_in_file" for warning in event.warnings) for event in matching)


def test_parser_synthesizes_stable_uid_for_all_day_events_without_uid() -> None:
    parsed = parse_ics(NO_UID_ALL_DAY_ICS)
    assert parsed.calendar_name == "Taiwan Holidays"
    assert len(parsed.events) == 3
    assert all(event.supported for event in parsed.events)
    assert all(event.is_all_day for event in parsed.events)
    assert all(event.uid.startswith("synth-") for event in parsed.events)
    assert all(not any(warning.code == "missing_uid" for warning in event.warnings) for event in parsed.events)

    again = parse_ics(NO_UID_ALL_DAY_ICS)
    assert [event.uid for event in again.events] == [event.uid for event in parsed.events]
    assert [event.fingerprint for event in again.events] == [event.fingerprint for event in parsed.events]
    assert len({event.uid for event in parsed.events}) == 3


async def test_preview_commit_no_uid_all_day_events_are_idempotent(client, app) -> None:
    preview = await client.post(
        "/api/v1/calendar/imports/preview",
        json={"content": NO_UID_ALL_DAY_ICS, "sourceId": "tw-holidays"},
    )
    assert preview.status_code == 200
    payload = preview.json()
    assert payload["importableCount"] == 3
    assert all(item["supported"] for item in payload["items"])
    assert all(item["action"] == "create" for item in payload["items"])
    assert all(item["isAllDay"] for item in payload["items"])
    assert all(not any(w["code"] == "missing_uid" for w in item["warnings"]) for item in payload["items"])

    selections = [{"uid": item["uid"], "fingerprint": item["fingerprint"]} for item in payload["items"]]
    committed = await client.post(
        "/api/v1/calendar/imports/commit",
        json={"content": NO_UID_ALL_DAY_ICS, "sourceId": "tw-holidays", "selections": selections},
    )
    assert committed.status_code == 200
    first = committed.json()
    assert first["createdCount"] == 3
    assert first["committedCount"] == 3

    again_preview = await client.post(
        "/api/v1/calendar/imports/preview",
        json={"content": NO_UID_ALL_DAY_ICS, "sourceId": "tw-holidays"},
    )
    assert again_preview.status_code == 200
    assert {item["action"] for item in again_preview.json()["items"]} == {"unchanged"}

    again_commit = await client.post(
        "/api/v1/calendar/imports/commit",
        json={
            "content": NO_UID_ALL_DAY_ICS,
            "sourceId": "tw-holidays",
            "selections": [
                {"uid": item["uid"], "fingerprint": item["fingerprint"]} for item in again_preview.json()["items"]
            ],
        },
    )
    assert again_commit.status_code == 200
    second = again_commit.json()
    assert second["createdCount"] == 0
    assert second["updatedCount"] == 0
    assert second["unchangedCount"] == 3
    assert await app.state.db.fetch_value("SELECT COUNT(*) FROM user_events WHERE ics_source = 'tw-holidays'") == 3


def test_parser_accepts_google_outlook_samples_and_marks_floating_time() -> None:
    parsed = parse_ics(GOOGLE_OUTLOOK_ICS)
    assert parsed.calendar_name == "Interop samples"
    assert len(parsed.events) == 2

    floating, all_day = parsed.events
    assert floating.timezone_id == "floating"
    assert floating.description == (
        "A long description that is folded by the producer and must remainreadable after RFC 5545 unfolding."
    )
    assert any(warning.code == "floating_time_system_zone" for warning in floating.warnings)
    assert all_day.is_all_day is True
    assert all_day.start_local == "2026-08-07"
    assert all_day.end_local == "2026-08-09"


async def test_preview_commit_uid_upsert_is_stable_and_diffed(client, app) -> None:
    preview = await client.post(
        "/api/v1/calendar/imports/preview",
        json={"content": ICS, "sourceId": "fixture"},
    )
    assert preview.status_code == 200
    payload = preview.json()
    assert payload["eventCount"] == 4
    by_uid = {item["uid"]: item for item in payload["items"] if item["supported"]}
    assert by_uid["single-1@example.test"]["action"] == "create"
    assert by_uid["series-1@example.test"]["targetType"] == "recurring"
    override = next(
        item for item in payload["items"] if item["uid"] == "series-1@example.test" and not item["supported"]
    )
    assert override["action"] == "unsupported"

    selected = [
        {"uid": uid, "fingerprint": by_uid[uid]["fingerprint"]}
        for uid in ("single-1@example.test", "series-1@example.test", "all-day@example.test")
    ]
    committed = await client.post(
        "/api/v1/calendar/imports/commit",
        json={"content": ICS, "sourceId": "fixture", "selections": selected},
    )
    assert committed.status_code == 200
    first = committed.json()
    assert first["createdCount"] == 3
    ids = {item["uid"]: item["targetId"] for item in first["results"]}

    unchanged_preview = await client.post(
        "/api/v1/calendar/imports/preview",
        json={"content": ICS, "sourceId": "fixture"},
    )
    assert {item["action"] for item in unchanged_preview.json()["items"] if item["supported"]} == {"unchanged"}

    modified = ICS.replace("SUMMARY:One\\, escaped event", "SUMMARY:Renamed event")
    changed_preview = await client.post(
        "/api/v1/calendar/imports/preview",
        json={"content": modified, "sourceId": "fixture"},
    )
    changed = next(item for item in changed_preview.json()["items"] if item["uid"] == "single-1@example.test")
    assert changed["action"] == "update"
    assert changed["existingId"] == ids["single-1@example.test"]
    assert {diff["field"] for diff in changed["changes"]} == {"title"}

    updated = await client.post(
        "/api/v1/calendar/imports/commit",
        json={
            "content": modified,
            "sourceId": "fixture",
            "selections": [{"uid": changed["uid"], "fingerprint": changed["fingerprint"]}],
        },
    )
    assert updated.status_code == 200
    assert updated.json()["results"][0]["targetId"] == ids["single-1@example.test"]
    assert (
        await app.state.db.fetch_value(
            "SELECT title FROM user_events WHERE id = ?",
            (ids["single-1@example.test"],),
        )
        == "Renamed event"
    )


async def test_commit_revalidates_fingerprint_before_transaction(client, app) -> None:
    response = await client.post(
        "/api/v1/calendar/imports/commit",
        json={
            "content": ICS,
            "sourceId": "stale",
            "selections": [
                {"uid": "single-1@example.test", "fingerprint": "not-the-preview-fingerprint"},
            ],
        },
    )
    assert response.status_code == 422
    assert await app.state.db.fetch_value("SELECT COUNT(*) FROM user_events WHERE ics_source = 'stale'") == 0
    assert await app.state.db.fetch_value("SELECT COUNT(*) FROM recurring_schedules WHERE ics_source = 'stale'") == 0


async def test_commit_rolls_back_every_selected_item_on_write_failure(app, monkeypatch) -> None:
    parsed = parse_ics(ICS)
    selected_events = [
        event for event in parsed.events if event.uid in {"single-1@example.test", "all-day@example.test"}
    ]
    monkeypatch.setattr("server.calendar.imports.new_id", lambda: "forced-primary-key-collision")

    with pytest.raises(aiosqlite.IntegrityError):
        await commit_calendar_import(
            app.state.db,
            content=ICS,
            source="rollback",
            selections=[ImportSelection(uid=event.uid, fingerprint=event.fingerprint) for event in selected_events],
        )

    assert await app.state.db.fetch_value("SELECT COUNT(*) FROM user_events WHERE ics_source = 'rollback'") == 0


async def test_imported_rrule_uses_real_anchor_timezone_exdate_and_rdate(client, app) -> None:
    preview = (
        await client.post(
            "/api/v1/calendar/imports/preview",
            json={"content": ICS, "sourceId": "expand"},
        )
    ).json()
    series = next(item for item in preview["items"] if item["uid"] == "series-1@example.test")
    committed = await client.post(
        "/api/v1/calendar/imports/commit",
        json={
            "content": ICS,
            "sourceId": "expand",
            "selections": [{"uid": series["uid"], "fingerprint": series["fingerprint"]}],
        },
    )
    series_id = committed.json()["results"][0]["targetId"]

    window = await query_window(
        app.state.db,
        start="2026-08-01T00:00:00Z",
        end="2026-08-31T23:59:59Z",
        series_id=series_id,
        limit=50,
    )
    starts = [item["startTime"] for item in window["items"] if item["source"] == "recurring"]
    assert starts == [
        "2026-08-03T01:00:00Z",
        "2026-08-11T01:00:00Z",
        "2026-08-17T01:00:00Z",
    ]
    assert all(item["timezone"] == "Asia/Hong_Kong" for item in window["items"])


async def test_all_day_until_exdate_and_rdate_keep_calendar_dates(client, app) -> None:
    preview = (
        await client.post(
            "/api/v1/calendar/imports/preview",
            json={"content": ALL_DAY_SERIES_ICS, "sourceId": "all-day-series"},
        )
    ).json()
    item = preview["items"][0]
    assert item["supported"] is True
    assert item["isAllDay"] is True
    committed = await client.post(
        "/api/v1/calendar/imports/commit",
        json={
            "content": ALL_DAY_SERIES_ICS,
            "sourceId": "all-day-series",
            "selections": [{"uid": item["uid"], "fingerprint": item["fingerprint"]}],
        },
    )
    series_id = committed.json()["results"][0]["targetId"]
    window = await query_window(
        app.state.db,
        start="2026-08-01T00:00:00Z",
        end="2026-08-05T23:59:59Z",
        series_id=series_id,
        limit=20,
    )
    recurring = [event for event in window["items"] if event["source"] == "recurring"]
    assert [event["startTime"] for event in recurring] == [
        "2026-08-01T00:00:00Z",
        "2026-08-03T00:00:00Z",
        "2026-08-04T00:00:00Z",
    ]
    assert all(event["isAllDay"] is True for event in recurring)
    assert all(event["endTime"] > event["startTime"] for event in recurring)


async def test_custom_vtimezone_survives_commit_and_expansion(client, app) -> None:
    preview = (
        await client.post(
            "/api/v1/calendar/imports/preview",
            json={"content": CUSTOM_TIMEZONE_ICS, "sourceId": "custom-zone"},
        )
    ).json()
    item = preview["items"][0]
    committed = await client.post(
        "/api/v1/calendar/imports/commit",
        json={
            "content": CUSTOM_TIMEZONE_ICS,
            "sourceId": "custom-zone",
            "selections": [{"uid": item["uid"], "fingerprint": item["fingerprint"]}],
        },
    )
    series_id = committed.json()["results"][0]["targetId"]
    row = await app.state.db.fetch_one("SELECT timezone_ical FROM recurring_schedules WHERE id = ?", (series_id,))
    assert row is not None and "BEGIN:VTIMEZONE" in row["timezone_ical"]

    window = await query_window(
        app.state.db,
        start="2026-08-01T00:00:00Z",
        end="2026-08-03T00:00:00Z",
        task_id=series_id,
        limit=20,
    )
    assert [event["startTime"] for event in window["items"]] == [
        "2026-08-01T01:00:00Z",
        "2026-08-02T01:00:00Z",
    ]


async def test_api_commit_is_visible_to_user_event_calendar_and_agent_consumers(client, app) -> None:
    preview = (
        await client.post(
            "/api/v1/calendar/imports/preview",
            json={"content": ICS, "sourceId": "consumer-chain"},
        )
    ).json()
    selected = [
        {"uid": item["uid"], "fingerprint": item["fingerprint"]}
        for item in preview["items"]
        if item["supported"] and item["uid"] in {"single-1@example.test", "series-1@example.test"}
    ]
    committed = await client.post(
        "/api/v1/calendar/imports/commit",
        json={"content": ICS, "sourceId": "consumer-chain", "selections": selected},
    )
    assert committed.status_code == 200
    ids = {item["uid"]: item["targetId"] for item in committed.json()["results"]}

    user_events = await client.get(
        "/api/v1/calendar/user-events",
        params={"start": "2026-08-01T00:00:00Z", "end": "2026-08-31T23:59:59Z"},
    )
    assert user_events.status_code == 200
    imported_user = next(item for item in user_events.json()["items"] if item["id"] == ids["single-1@example.test"])
    assert imported_user["origin"] == "ics"
    assert imported_user["icsUid"] == "single-1@example.test"

    occurrences = await client.get(
        "/api/v1/calendar/occurrences",
        params={
            "rangeStart": "2026-08-01T00:00:00Z",
            "rangeEnd": "2026-08-31T23:59:59Z",
            "seriesId": ids["series-1@example.test"],
        },
    )
    assert occurrences.status_code == 200
    assert [item["startTime"] for item in occurrences.json()] == [
        "2026-08-03T01:00:00Z",
        "2026-08-11T01:00:00Z",
        "2026-08-17T01:00:00Z",
    ]

    agent_window = await execute_calendar_tool(
        app.state.db,
        "calendar.window",
        {
            "start": "2026-08-01T00:00:00Z",
            "end": "2026-08-31T23:59:59Z",
            "limit": 20,
        },
    )
    by_source = {item["source"] for item in agent_window["items"]}
    assert {"user", "recurring"} <= by_source
    assert ids["single-1@example.test"] in {item["id"] for item in agent_window["items"]}
    assert any(item.get("seriesId") == ids["series-1@example.test"] for item in agent_window["items"])


def test_openapi_exposes_concrete_import_contract(app) -> None:
    schema = app.openapi()
    assert "/api/v1/calendar/imports/preview" in schema["paths"]
    assert "/api/v1/calendar/imports/commit" in schema["paths"]
    preview_response = schema["paths"]["/api/v1/calendar/imports/preview"]["post"]["responses"]["200"]
    assert "CalendarImportPreviewResponse" in str(preview_response)

"""Unit tests for the unified calendar query layer."""

from __future__ import annotations

from datetime import datetime, timezone

from server.calendar.query import (
    HORIZON_DAYS,
    get_event,
    list_calendars,
    query_upcoming,
    query_window,
)
from server.tests import seed


async def test_list_calendars_includes_event_and_recurring_tasks(app) -> None:
    calendars = await list_calendars(app.state.db)
    modes = {c["analysisMode"] for c in calendars}
    ids = {c["id"] for c in calendars}
    assert "recurring" in modes
    assert "event" in modes
    assert seed.TASK_CALENDAR in ids
    assert seed.TASK_EVENT in ids
    # Metadata only — no event body payload.
    assert all("body" not in c for c in calendars)


async def test_query_window_merges_analysis_events_and_rrule(app) -> None:
    db = app.state.db
    # Window covering the seeded timed event (2026-07-15) and Monday weekly meetings.
    result = await query_window(
        db,
        start="2026-07-13T00:00:00Z",
        end="2026-07-21T23:59:59Z",
        limit=50,
    )
    items = result["items"]
    sources = {item["source"] for item in items}
    assert "analysis" in sources
    assert "recurring" in sources

    analysis = next(i for i in items if i["id"] == "ev-1")
    assert analysis["title"] == "季度會議"
    assert analysis["startTime"].startswith("2026-07-15")

    recurring_items = [i for i in items if i["source"] == "recurring"]
    assert any(i["taskId"] == seed.TASK_CALENDAR for i in recurring_items)
    assert all({"id", "taskId", "title", "startTime", "endTime", "source"} <= set(i) for i in items)


async def test_query_window_merges_user_events(app) -> None:
    from server.calendar.user_events import create_user_event, list_user_events

    db = app.state.db
    created = await create_user_event(
        db,
        title="用戶事件測試",
        start_time="2026-07-16T12:00:00Z",
        origin="manual",
    )
    result = await query_window(
        db,
        start="2026-07-13T00:00:00Z",
        end="2026-07-21T23:59:59Z",
        limit=100,
    )
    user_items = [i for i in result["items"] if i["source"] == "user"]
    assert any(i["id"] == created["id"] for i in user_items)
    match = next(i for i in user_items if i["id"] == created["id"])
    assert match["origin"] == "manual"
    assert match["title"] == "用戶事件測試"

    # Untagged user events are excluded when filtering by a concrete task.
    filtered = await query_window(
        db,
        start="2026-07-13T00:00:00Z",
        end="2026-07-21T23:59:59Z",
        task_id=seed.TASK_CALENDAR,
        limit=100,
    )
    assert all(i["id"] != created["id"] for i in filtered["items"] if i["source"] == "user")

    # Tagged user events appear under that task filter.
    tagged = await create_user_event(
        db,
        title="掛到行事曆任務",
        start_time="2026-07-16T13:00:00Z",
        origin="manual",
        task_id=seed.TASK_CALENDAR,
    )
    filtered_tagged = await query_window(
        db,
        start="2026-07-13T00:00:00Z",
        end="2026-07-21T23:59:59Z",
        task_id=seed.TASK_CALENDAR,
        limit=100,
    )
    assert any(i["id"] == tagged["id"] and i["taskId"] == seed.TASK_CALENDAR for i in filtered_tagged["items"])

    # System-workset filter: ownership ``__user__`` only (no analysis/RRULE).
    # Events with task provenance still appear when their workset is builtin.
    system_ws = await query_window(
        db,
        start="2026-07-13T00:00:00Z",
        end="2026-07-21T23:59:59Z",
        workset_id="__user__",
        limit=100,
    )
    assert all(i["source"] == "user" for i in system_ws["items"])
    assert any(i["id"] == created["id"] for i in system_ws["items"])
    assert any(i["id"] == tagged["id"] for i in system_ws["items"])

    # Empty task_id = NULL provenance only (not ownership).
    null_provenance = await list_user_events(db, task_id="")
    null_ids = {item["id"] for item in null_provenance}
    assert created["id"] in null_ids
    assert tagged["id"] not in null_ids


async def test_query_window_cursor_pages(app) -> None:
    db = app.state.db
    page1 = await query_window(
        db,
        start="2026-07-01T00:00:00Z",
        end="2026-08-31T23:59:59Z",
        limit=1,
    )
    assert len(page1["items"]) == 1
    assert page1["nextCursor"] == "1"

    page2 = await query_window(
        db,
        start="2026-07-01T00:00:00Z",
        end="2026-08-31T23:59:59Z",
        limit=1,
        cursor=page1["nextCursor"],
    )
    assert len(page2["items"]) == 1
    assert page1["items"][0]["id"] != page2["items"][0]["id"]


async def test_query_upcoming_respects_now_and_hard_cap(app) -> None:
    db = app.state.db
    now = datetime(2026, 7, 10, 0, 0, tzinfo=timezone.utc)
    result = await query_upcoming(db, limit=500, now=now, hard_cap=100)
    assert result["limit"] == 100
    assert len(result["items"]) <= 100
    for item in result["items"]:
        start = item.get("startTime")
        assert start is not None
        assert start >= "2026-07-10"


async def test_query_window_date_only_end_includes_whole_day(app) -> None:
    db = app.state.db
    # Seeded analysis event is 2026-07-15 — date-only end must not truncate at 00:00.
    result = await query_window(
        db,
        start="2026-07-15",
        end="2026-07-15",
        limit=50,
    )
    assert any(i["id"] == "ev-1" for i in result["items"])


async def test_query_upcoming_days_clamps_to_horizon(app) -> None:
    db = app.state.db
    now = datetime(2026, 7, 10, 0, 0, tzinfo=timezone.utc)
    over = await query_upcoming(db, limit=50, days=HORIZON_DAYS + 1, now=now)
    assert over["days"] == HORIZON_DAYS
    at_cap = await query_upcoming(db, limit=50, days=HORIZON_DAYS, now=now)
    assert at_cap["days"] == HORIZON_DAYS
    default = await query_upcoming(db, limit=50, now=now)
    assert default["days"] == HORIZON_DAYS


async def test_query_upcoming_days_includes_local_midnight_plus08(app) -> None:
    """HK all-day 7/20 (= 2026-07-19T16:00:00Z) must appear in「未來7天」from evening of 7/19 UTC+8."""
    db = app.state.db
    await db.execute(
        "INSERT INTO analysis_events ("
        "id, task_id, version, batch_id, title, body, start_time, end_time, "
        "location, latitude, longitude, participants_json, source_message_id, "
        "batch_source_channel_names, content_hash, semantic_hash, event_key, "
        "created_at, updated_at"
        ") VALUES ("
        "?, ?, 1, ?, 'RiseX 點數計', '', "
        "'2026-07-20T00:00:00+08:00', NULL, '', NULL, NULL, '[]', NULL, "
        "'[]', 'h1', 's1', 'ek-risex', "
        "'2026-07-19T10:00:00Z', '2026-07-19T10:00:00Z')",
        ("ev-risex", seed.TASK_EVENT_TIMED, seed.BATCH_EVENT_TIMED),
    )
    # 2026-07-19 20:00 +08 = 2026-07-19 12:00 UTC — before event UTC instant.
    now = datetime(2026, 7, 19, 12, 0, tzinfo=timezone.utc)
    result = await query_upcoming(db, limit=50, days=7, now=now)
    titles = [i["title"] for i in result["items"]]
    assert "RiseX 點數計" in titles
    assert result["days"] == 7

    # Model-style window that starts at UTC midnight 7/20 wrongly drops +08 midnight events.
    bad = await query_window(
        db,
        start="2026-07-20T00:00:00Z",
        end="2026-07-26T23:59:59Z",
        limit=50,
    )
    assert not any(i["id"] == "ev-risex" for i in bad["items"])


async def test_get_event_analysis_and_rrule_occurrence(app) -> None:
    db = app.state.db
    analysis = await get_event(db, event_id="ev-1")
    assert analysis is not None
    assert analysis["title"] == "季度會議"
    assert analysis["source"] == "analysis"
    assert "Q3" in (analysis.get("body") or "")

    window = await query_window(
        db,
        start="2026-07-06T00:00:00Z",
        end="2026-07-06T23:59:59Z",
        task_id=seed.TASK_CALENDAR,
    )
    assert window["items"], "expected at least one Monday occurrence"
    occ_id = window["items"][0]["id"]
    detail = await get_event(db, event_id=occ_id)
    assert detail is not None
    assert detail["source"] == "recurring"
    assert detail["taskId"] == seed.TASK_CALENDAR
    assert detail["id"] == occ_id


async def test_get_event_returns_user_event_detail(app) -> None:
    from server.calendar.user_events import create_user_event

    created = await create_user_event(
        app.state.db,
        title="用戶事件詳情",
        start_time="2026-07-23T09:00:00Z",
        end_time="2026-07-23T10:00:00Z",
        body="詳情內容",
        location="九龍",
        origin="assistant",
    )

    detail = await get_event(app.state.db, event_id=created["id"])

    assert detail == {
        "id": created["id"],
        "taskId": "",
        "worksetId": "__user__",
        "title": "用戶事件詳情",
        "startTime": "2026-07-23T09:00:00Z",
        "endTime": "2026-07-23T10:00:00Z",
        "location": "九龍",
        "source": "user",
        "origin": "assistant",
        "isAllDay": False,
        "timezone": None,
        "icsUid": None,
        "icsSource": None,
        "body": "詳情內容",
        "createdAt": created["createdAt"],
        "updatedAt": created["updatedAt"],
        "dismissed": False,
    }


async def test_query_window_filters_by_workset_id(app) -> None:
    from server.calendar.user_events import create_user_event
    from server.db.database import TransactionDb
    from server.queries.worksets_queries import insert_workset
    from server.util import utc_now_iso

    db = app.state.db
    now = utc_now_iso()
    async with db.transaction() as conn:
        await insert_workset(TransactionDb(conn), workset_id="ws-cal", name="Cal WS", now=now)
    await create_user_event(
        db,
        title="In workset",
        start_time="2026-07-16T14:00:00Z",
        workset_id="ws-cal",
    )
    await create_user_event(
        db,
        title="System owned",
        start_time="2026-07-16T15:00:00Z",
        workset_id="__user__",
    )
    filtered = await query_window(
        db,
        start="2026-07-13T00:00:00Z",
        end="2026-07-21T23:59:59Z",
        workset_id="ws-cal",
        limit=100,
    )
    user_items = [i for i in filtered["items"] if i["source"] == "user"]
    assert len(user_items) == 1
    assert user_items[0]["title"] == "In workset"
    assert user_items[0]["worksetId"] == "ws-cal"

"""include_in_timeline: excluded from calendar planning, still on /results/events."""

from __future__ import annotations

from server.calendar.query import query_window
from server.services.task_writes import resolve_include_in_timeline
from server.tests import seed


def test_resolve_include_in_timeline_modes() -> None:
    assert resolve_include_in_timeline(effective_mode="recurring", supplied=False) == 1
    assert resolve_include_in_timeline(effective_mode="intel_event", supplied=False) == 0
    assert resolve_include_in_timeline(effective_mode="intel_event", supplied=True) == 1
    assert resolve_include_in_timeline(effective_mode="intel_event", supplied=None, existing=0) == 0
    assert resolve_include_in_timeline(effective_mode="intel_event", supplied=None) == 1


async def test_include_in_timeline_false_excluded_from_calendar_still_on_events(app, client) -> None:
    db = app.state.db
    await db.execute(
        "UPDATE analysis_tasks SET include_in_timeline = 0 WHERE id = ?",
        (seed.TASK_EVENT_TIMED,),
    )

    window = await query_window(
        db,
        start="2026-07-13T00:00:00Z",
        end="2026-07-21T23:59:59Z",
        limit=100,
    )
    analysis_ids = {item["id"] for item in window["items"] if item.get("source") == "analysis"}
    assert "ev-1" not in analysis_ids

    timed = await client.get(
        "/api/v1/results/events",
        params={"hasTime": "1", "includeInTimeline": "1", "limit": "50"},
    )
    assert timed.status_code == 200
    assert all(item["id"] != "ev-1" for item in timed.json()["items"])

    # Intelligence / map default path still returns the event.
    events = await client.get("/api/v1/results/events", params={"limit": "50"})
    assert events.status_code == 200
    assert any(item["id"] == "ev-1" for item in events.json()["items"])


async def test_events_task_ids_multi_filter(client) -> None:
    multi = await client.get(
        "/api/v1/results/events",
        params=[
            ("taskIds", seed.TASK_EVENT),
            ("taskIds", seed.TASK_EVENT_TIMED),
            ("limit", "50"),
        ],
    )
    assert multi.status_code == 200
    ids = {item["taskId"] for item in multi.json()["items"]}
    assert ids <= {seed.TASK_EVENT, seed.TASK_EVENT_TIMED}
    assert seed.TASK_EVENT in ids
    assert seed.TASK_EVENT_TIMED in ids

    single = await client.get(
        "/api/v1/results/events",
        params={"taskId": seed.TASK_EVENT_TIMED, "limit": "50"},
    )
    assert single.status_code == 200
    assert all(item["taskId"] == seed.TASK_EVENT_TIMED for item in single.json()["items"])
    assert any(item["id"] == "ev-1" for item in single.json()["items"])

"""UI prefs board layout / widgetState sanitize + API."""

from __future__ import annotations

from server.config import get_config
from server.tests.ui_prefs_helpers import ui_pref_payload
from server.ui_prefs import (
    KEY_OPS_BOARD_LAYOUT,
    KEY_OPS_BOARD_WIDGET_STATE,
    MAX_PREF_JSON_CHARS,
    sanitize_board_layout,
    sanitize_board_widget_state,
)


def test_sanitize_board_layout_requires_structure() -> None:
    clean = sanitize_board_layout(
        {
            "version": 14,
            "widgets": [
                {"i": "w1", "type": "map", "col": 0, "row": 0, "sizeId": "4x3", "z": 1},
                {"i": "", "type": "feed"},
                "skip-me",
            ],
        }
    )
    assert clean == {
        "version": 14,
        "widgets": [{"i": "w1", "type": "map", "col": 0, "row": 0, "sizeId": "4x3", "z": 1}],
    }


async def test_board_empty_default(client) -> None:
    resp = await client.get("/api/v1/ui-prefs/board")
    assert resp.status_code == 200
    assert resp.json() == {"configured": False, "layout": None, "widgetState": None}


async def test_board_roundtrip(client, app) -> None:
    layout = {
        "version": 14,
        "widgets": [{"i": "map-1", "type": "map", "col": 0, "row": 0, "sizeId": "4x3"}],
    }
    widget_state = {
        "mapViews": {"map-1": {"center": [20.0, 0.0], "zoom": 2}},
        "sourceFilters": {
            "gantt-1": {"taskIds": ["task-a", "task-b"], "worksetIds": []},
            "gantt-2": None,
        },
        "ganttViewModes": {"gantt-1": "day", "gantt-2": "month"},
    }
    put = await client.put(
        "/api/v1/ui-prefs/board",
        json={"layout": layout, "widgetState": widget_state},
    )
    assert put.status_code == 200
    body = put.json()
    assert body["configured"] is True
    assert body["layout"]["version"] == 14
    assert body["layout"]["widgets"][0]["i"] == "map-1"
    assert body["widgetState"]["mapViews"]["map-1"]["zoom"] == 2.0
    assert body["widgetState"]["sourceFilters"]["gantt-1"] == {
        "taskIds": ["task-a", "task-b"],
        "worksetIds": [],
    }
    assert body["widgetState"]["sourceFilters"]["gantt-2"] is None
    assert body["widgetState"]["ganttViewModes"] == {"gantt-1": "day", "gantt-2": "month"}

    again = await client.get("/api/v1/ui-prefs/board")
    assert again.status_code == 200
    assert again.json() == body

    raw_layout = await ui_pref_payload(app.state.db, KEY_OPS_BOARD_LAYOUT)
    raw_widget = await ui_pref_payload(app.state.db, KEY_OPS_BOARD_WIDGET_STATE)
    assert raw_layout is not None and raw_layout.startswith("{")
    assert raw_widget is not None and "mapViews" in raw_widget
    assert await get_config(app.state.db, KEY_OPS_BOARD_LAYOUT) == ""


def test_sanitize_board_widget_state_drops_flat_source_filters() -> None:
    """Sanitize hard-cuts flat/legacy shapes; PUT body schema rejects them earlier."""
    clean = sanitize_board_widget_state(
        {
            "mapViews": {},
            "sourceFilters": {
                "events-1": {
                    "taskIds": ["t1", "t1", ""],
                    "worksetIds": ["__user__", "ws-a"],
                },
                "legacy-flat": ["old-a", "old-b"],
                "bad-shape": {"taskIds": "nope"},
                "all-sources": None,
            },
            "ganttViewModes": {"gantt-1": "day", "bad": "week"},
        }
    )
    assert clean["sourceFilters"] == {
        "events-1": {"taskIds": ["t1"], "worksetIds": ["__user__", "ws-a"]},
        "all-sources": None,
    }
    assert clean["ganttViewModes"] == {"gantt-1": "day"}


async def test_board_source_filters_hierarchical_shape(client) -> None:
    """Ownership v3 tree filter persists as {taskIds, worksetIds}; null = all sources."""
    put = await client.put(
        "/api/v1/ui-prefs/board",
        json={
            "widgetState": {
                "mapViews": {},
                "sourceFilters": {
                    "events-1": {
                        "taskIds": ["t1", "t1", ""],
                        "worksetIds": ["__user__", "ws-a"],
                    },
                    "all-sources": None,
                },
                "ganttViewModes": {},
            }
        },
    )
    assert put.status_code == 200
    filters = put.json()["widgetState"]["sourceFilters"]
    assert filters["events-1"] == {
        "taskIds": ["t1"],
        "worksetIds": ["__user__", "ws-a"],
    }
    assert filters["all-sources"] is None


async def test_board_source_filters_reject_flat_shape(client) -> None:
    put = await client.put(
        "/api/v1/ui-prefs/board",
        json={
            "widgetState": {
                "mapViews": {},
                "sourceFilters": {"legacy-flat": ["old-a", "old-b"]},
                "ganttViewModes": {},
            }
        },
    )
    assert put.status_code == 422
    assert put.json()["error_code"] == "VALIDATION_ERROR"


async def test_board_partial_put_and_clear(client) -> None:
    await client.put(
        "/api/v1/ui-prefs/board",
        json={
            "layout": {
                "version": 14,
                "widgets": [{"i": "a", "type": "feed", "col": 1, "row": 1, "sizeId": "2x2"}],
            },
            "widgetState": {"mapViews": {}, "sourceFilters": {}, "ganttViewModes": {}},
        },
    )
    only_layout = await client.put(
        "/api/v1/ui-prefs/board",
        json={
            "layout": {
                "version": 14,
                "widgets": [{"i": "b", "type": "wall", "col": 0, "row": 0, "sizeId": "4x3"}],
            }
        },
    )
    assert only_layout.status_code == 200
    assert only_layout.json()["layout"]["widgets"][0]["i"] == "b"
    assert only_layout.json()["widgetState"] == {
        "mapViews": {},
        "sourceFilters": {},
        "ganttViewModes": {},
    }

    cleared = await client.put("/api/v1/ui-prefs/board", json={"widgetState": None})
    assert cleared.status_code == 200
    assert cleared.json()["configured"] is True
    assert cleared.json()["layout"]["widgets"][0]["i"] == "b"
    assert cleared.json()["widgetState"] is None

    cleared_all = await client.put("/api/v1/ui-prefs/board", json={"layout": None})
    assert cleared_all.status_code == 200
    assert cleared_all.json() == {"configured": False, "layout": None, "widgetState": None}


async def test_board_oversized_payload_422(client) -> None:
    huge = "x" * (MAX_PREF_JSON_CHARS)
    resp = await client.put(
        "/api/v1/ui-prefs/board",
        json={
            "layout": {
                "version": 14,
                "widgets": [
                    {
                        "i": huge,
                        "type": "map",
                        "col": 0,
                        "row": 0,
                        "sizeId": "4x3",
                    }
                ],
            }
        },
    )
    assert resp.status_code == 422
    assert "character limit" in resp.json()["message"]


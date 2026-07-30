"""API + sanitize tests for /api/v1/ui-prefs (board + voice reminder)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from server.config import CONFIG_DEFAULTS, get_config
from server.db.database import Database
from server.ui_prefs import (
    KEY_OPS_BOARD_LAYOUT,
    KEY_OPS_BOARD_WIDGET_STATE,
    KEY_VOICE_REMINDER_FIRED,
    KEY_VOICE_REMINDER_SETTINGS,
    KEY_VOICE_REMINDER_TRIGGER_HISTORY,
    MAX_PREF_JSON_CHARS,
    MAX_VOICE_HISTORY_ENTRIES,
    UI_PREF_KEYS,
    sanitize_board_layout,
    sanitize_fired_keys,
    sanitize_voice_history,
    sanitize_voice_settings,
)


async def _ui_pref_payload(db: Database, key: str) -> Optional[str]:
    return await db.fetch_value("SELECT payload_json FROM ui_prefs WHERE key = ?", (key,))


def test_ui_pref_keys_retired_from_config_defaults() -> None:
    for key in UI_PREF_KEYS:
        assert key not in CONFIG_DEFAULTS


def test_sanitize_voice_settings_defaults_and_leads() -> None:
    clean = sanitize_voice_settings(
        {
            "enabled": True,
            "leadOffsetsMinutes": [60, 15, 99, 15],
            "sourceFilter": {
                "taskIds": ["a", "", "a", "b"],
                "worksetIds": ["__user__", "ws-1", "ws-1"],
            },
            "preambleChimeId": "soft-bell",
            "quietHours": {"enabled": False, "start": "bad", "end": "08:30"},
        }
    )
    assert clean["enabled"] is True
    assert clean["leadOffsetsMinutes"] == [15, 60]
    assert clean["sourceFilter"] == {
        "taskIds": ["a", "b"],
        "worksetIds": ["__user__", "ws-1"],
    }
    assert clean["preambleChimeId"] == "broadcast"
    assert clean["quietHours"] == {"enabled": False, "start": "22:00", "end": "08:30"}
    assert "taskIds" not in clean

    missing = sanitize_voice_settings({"enabled": False})
    assert missing["sourceFilter"] == {"taskIds": [], "worksetIds": ["__user__"]}
    assert sanitize_voice_settings({"sourceFilter": None})["sourceFilter"] is None
    # Flat legacy taskIds discarded → default (no silent upgrade).
    assert sanitize_voice_settings({"taskIds": []})["sourceFilter"] == {
        "taskIds": [],
        "worksetIds": ["__user__"],
    }
    assert sanitize_voice_settings({"taskIds": ["__user__", "t1"]})["sourceFilter"] == {
        "taskIds": [],
        "worksetIds": ["__user__"],
    }
    assert sanitize_voice_settings({"sourceFilter": ["t1"]})["sourceFilter"] == {
        "taskIds": [],
        "worksetIds": ["__user__"],
    }

def test_sanitize_voice_history_caps_at_100() -> None:
    rows = [
        {
            "id": f"id-{i}",
            "triggerReason": f"r{i}",
            "status": "success",
            "errorMessage": None,
            "triggeredAt": "2026-07-24T00:00:00Z",
        }
        for i in range(MAX_VOICE_HISTORY_ENTRIES + 25)
    ]
    clean = sanitize_voice_history(rows)
    assert len(clean) == MAX_VOICE_HISTORY_ENTRIES
    assert clean[0]["id"] == "id-0"
    assert clean[-1]["id"] == f"id-{MAX_VOICE_HISTORY_ENTRIES - 1}"


def test_sanitize_fired_keys_prunes_old() -> None:
    now = datetime(2026, 7, 24, tzinfo=timezone.utc)
    fresh_start = (now - timedelta(hours=1)).isoformat().replace("+00:00", "Z")
    old_start = (now - timedelta(days=5)).isoformat().replace("+00:00", "Z")
    keys = [
        f"evt-1::60::{fresh_start}",
        f"evt-2::15::{old_start}",
        "not-a-dedupe-key",
        "",
    ]
    kept = sanitize_fired_keys(keys, now_ms=now.timestamp() * 1000, prune=True)
    assert kept == [f"evt-1::60::{fresh_start}"]


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
        "ganttViewModes": {"gantt-1": "day", "gantt-2": "month", "bad": "week"},
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

    raw_layout = await _ui_pref_payload(app.state.db, KEY_OPS_BOARD_LAYOUT)
    raw_widget = await _ui_pref_payload(app.state.db, KEY_OPS_BOARD_WIDGET_STATE)
    assert raw_layout is not None and raw_layout.startswith("{")
    assert raw_widget is not None and "mapViews" in raw_widget
    assert await get_config(app.state.db, KEY_OPS_BOARD_LAYOUT) == ""


async def test_board_source_filters_hierarchical_shape(client) -> None:
    """Ownership v3 tree filter persists as {taskIds, worksetIds}; flat discarded."""
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
                    "legacy-flat": ["old-a", "old-b"],
                    "bad-shape": {"taskIds": "nope"},
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
    assert "legacy-flat" not in filters
    assert "bad-shape" not in filters
    assert filters["all-sources"] is None


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


async def test_voice_settings_empty_and_roundtrip(client, app) -> None:
    empty = await client.get("/api/v1/ui-prefs/voice-reminder/settings")
    assert empty.status_code == 200
    assert empty.json() == {"configured": False, "settings": None}

    put = await client.put(
        "/api/v1/ui-prefs/voice-reminder/settings",
        json={
            "settings": {
                "enabled": True,
                "leadOffsetsMinutes": [240, 15],
                "sourceFilter": {"taskIds": [], "worksetIds": ["__user__"]},
                "preambleChimeId": "airport",
                "quietHours": {"enabled": True, "start": "23:00", "end": "06:00"},
            }
        },
    )
    assert put.status_code == 200
    settings = put.json()["settings"]
    assert settings["enabled"] is True
    assert settings["leadOffsetsMinutes"] == [15, 240]
    assert settings["sourceFilter"] == {"taskIds": [], "worksetIds": ["__user__"]}
    assert settings["preambleChimeId"] == "airport"
    stored = await _ui_pref_payload(app.state.db, KEY_VOICE_REMINDER_SETTINGS)
    assert stored is not None
    assert '"enabled":true' in stored.replace(" ", "")
    assert await get_config(app.state.db, KEY_VOICE_REMINDER_SETTINGS) == ""


async def test_voice_fired_claim_dedupes_across_clients(client, app) -> None:
    now = datetime.now(timezone.utc)
    fresh = (now + timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
    key = f"ev-1::60::{fresh}"
    first = await client.post(
        "/api/v1/ui-prefs/voice-reminder/fired/claim",
        json={"keys": [key]},
    )
    assert first.status_code == 200
    body = first.json()
    assert body["claimed"] == [key]
    assert key in body["keys"]

    second = await client.post(
        "/api/v1/ui-prefs/voice-reminder/fired/claim",
        json={"keys": [key]},
    )
    assert second.status_code == 200
    assert second.json()["claimed"] == []


async def test_voice_fired_empty_roundtrip_and_prune(client, app) -> None:
    empty = await client.get("/api/v1/ui-prefs/voice-reminder/fired")
    assert empty.status_code == 200
    assert empty.json() == {"configured": False, "keys": None}

    now = datetime.now(timezone.utc)
    fresh = (now - timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
    stale = (now - timedelta(days=10)).strftime("%Y-%m-%dT%H:%M:%SZ")
    put = await client.put(
        "/api/v1/ui-prefs/voice-reminder/fired",
        json={"keys": [f"e1::60::{fresh}", f"e2::15::{stale}", "bad"]},
    )
    assert put.status_code == 200
    assert put.json()["configured"] is True
    assert put.json()["keys"] == [f"e1::60::{fresh}"]
    stored = await _ui_pref_payload(app.state.db, KEY_VOICE_REMINDER_FIRED)
    assert stored is not None
    assert "e1::60::" in stored
    assert "e2::15::" not in stored


async def test_voice_history_empty_roundtrip_and_truncate(client, app) -> None:
    empty = await client.get("/api/v1/ui-prefs/voice-reminder/history")
    assert empty.status_code == 200
    assert empty.json() == {"configured": False, "entries": None}

    entries = [
        {
            "id": f"h-{i}",
            "triggerReason": f"reason-{i}",
            "status": "success" if i % 2 == 0 else "failure",
            "errorMessage": None if i % 2 == 0 else "boom",
            "triggeredAt": "2026-07-24T12:00:00Z",
            "eventId": f"evt-{i}",
            "title": f"T{i}",
            "leadOffsetMinutes": 60,
        }
        for i in range(MAX_VOICE_HISTORY_ENTRIES + 10)
    ]
    put = await client.put(
        "/api/v1/ui-prefs/voice-reminder/history",
        json={"entries": entries},
    )
    assert put.status_code == 200
    body = put.json()
    assert body["configured"] is True
    assert len(body["entries"]) == MAX_VOICE_HISTORY_ENTRIES
    assert body["entries"][0]["id"] == "h-0"
    stored = await _ui_pref_payload(app.state.db, KEY_VOICE_REMINDER_TRIGGER_HISTORY)
    assert stored is not None and stored.startswith("[")


async def test_voice_history_oversized_payload_422(client) -> None:
    # One huge reason string forces the encoded JSON over the cap.
    huge = "x" * (MAX_PREF_JSON_CHARS)
    resp = await client.put(
        "/api/v1/ui-prefs/voice-reminder/history",
        json={
            "entries": [
                {
                    "id": "1",
                    "triggerReason": huge,
                    "status": "success",
                    "errorMessage": None,
                    "triggeredAt": "2026-07-24T00:00:00Z",
                }
            ]
        },
    )
    assert resp.status_code == 422
    assert "character limit" in resp.json()["message"]


DEVICE_A = "11111111-1111-4111-8111-111111111111"
DEVICE_B = "22222222-2222-4222-8222-222222222222"


async def test_assistant_sessions_roundtrip_and_delete_via_put(client, app) -> None:
    empty = await client.get(
        "/api/v1/ui-prefs/assistant/sessions",
        params={"deviceId": DEVICE_A},
    )
    assert empty.status_code == 200
    assert empty.json() == {
        "configured": False,
        "sessions": None,
        "activeSessionId": None,
    }

    put = await client.put(
        "/api/v1/ui-prefs/assistant/sessions",
        json={
            "deviceId": DEVICE_A,
            "sessions": [
                {
                    "id": "asst-1",
                    "title": "Hello",
                    "updatedAt": 100,
                    "messages": [
                        {"id": "m1", "role": "user", "content": "hi"},
                        {"id": "m2", "role": "assistant", "content": "hey"},
                    ],
                    "sessionId": "srv-1",
                },
                {
                    "id": "asst-2",
                    "title": "Other",
                    "updatedAt": 200,
                    "messages": [],
                },
            ],
            "activeSessionId": "asst-1",
        },
    )
    assert put.status_code == 200
    body = put.json()
    assert body["configured"] is True
    assert body["activeSessionId"] == "asst-1"
    assert {s["id"] for s in body["sessions"]} == {"asst-1", "asst-2"}

    deleted = await client.put(
        "/api/v1/ui-prefs/assistant/sessions",
        json={
            "deviceId": DEVICE_A,
            "sessions": [
                {
                    "id": "asst-2",
                    "title": "Other",
                    "updatedAt": 200,
                    "messages": [],
                }
            ],
            "activeSessionId": None,
        },
    )
    assert deleted.status_code == 200
    assert deleted.json()["sessions"][0]["id"] == "asst-2"
    assert deleted.json()["activeSessionId"] is None
    row = await app.state.db.fetch_one(
        "SELECT payload_json FROM assistant_device_stores WHERE device_id = ?",
        (DEVICE_A,),
    )
    assert row is not None
    stored = str(row["payload_json"])
    assert "asst-1" not in stored
    assert "asst-2" in stored
    assert await get_config(app.state.db, "assistant_sessions") == ""


async def test_assistant_sessions_two_devices_isolated(client, app) -> None:
    await client.put(
        "/api/v1/ui-prefs/assistant/sessions",
        json={
            "deviceId": DEVICE_A,
            "sessions": [
                {
                    "id": "asst-a",
                    "title": "Device A",
                    "updatedAt": 10,
                    "messages": [{"id": "m1", "role": "user", "content": "a"}],
                }
            ],
            "activeSessionId": "asst-a",
        },
    )
    await client.put(
        "/api/v1/ui-prefs/assistant/sessions",
        json={
            "deviceId": DEVICE_B,
            "sessions": [
                {
                    "id": "asst-b",
                    "title": "Device B",
                    "updatedAt": 20,
                    "messages": [{"id": "m2", "role": "user", "content": "b"}],
                }
            ],
            "activeSessionId": "asst-b",
        },
    )

    get_a = await client.get(
        "/api/v1/ui-prefs/assistant/sessions",
        params={"deviceId": DEVICE_A},
    )
    get_b = await client.get(
        "/api/v1/ui-prefs/assistant/sessions",
        params={"deviceId": DEVICE_B},
    )
    assert get_a.json()["activeSessionId"] == "asst-a"
    assert get_b.json()["activeSessionId"] == "asst-b"
    assert {s["id"] for s in get_a.json()["sessions"]} == {"asst-a"}
    assert {s["id"] for s in get_b.json()["sessions"]} == {"asst-b"}


async def test_assistant_sessions_empty_device_stays_isolated(client, app) -> None:
    """Device B must stay empty while Device A has a store row."""
    await client.put(
        "/api/v1/ui-prefs/assistant/sessions",
        json={
            "deviceId": DEVICE_A,
            "sessions": [
                {
                    "id": "legacy-1",
                    "title": "Old chat",
                    "updatedAt": 1,
                    "messages": [{"id": "m0", "role": "user", "content": "legacy"}],
                }
            ],
            "activeSessionId": "legacy-1",
        },
    )

    empty_b = await client.get(
        "/api/v1/ui-prefs/assistant/sessions",
        params={"deviceId": DEVICE_B},
    )
    assert empty_b.json()["configured"] is False

    get_a = await client.get(
        "/api/v1/ui-prefs/assistant/sessions",
        params={"deviceId": DEVICE_A},
    )
    assert get_a.json()["sessions"][0]["id"] == "legacy-1"


async def test_assistant_sessions_requires_device_id(client) -> None:
    missing_get = await client.get("/api/v1/ui-prefs/assistant/sessions")
    assert missing_get.status_code == 422

    missing_put = await client.put(
        "/api/v1/ui-prefs/assistant/sessions",
        json={"sessions": [], "activeSessionId": None},
    )
    assert missing_put.status_code == 422


async def test_assistant_voice_io_roundtrip(client, app) -> None:
    empty = await client.get("/api/v1/ui-prefs/assistant/voice-io")
    assert empty.status_code == 200
    assert empty.json() == {"configured": False, "settings": None}

    put = await client.put(
        "/api/v1/ui-prefs/assistant/voice-io",
        json={
            "settings": {
                "sttProvider": "browser",
                "ttsProvider": "browser",
                "ttsEnabled": False,
                "speechLanguage": "en-US",
                "ttsVoiceUri": "Microsoft Tracy - Chinese (Traditional, Hong Kong S.A.R.)",
            }
        },
    )
    assert put.status_code == 200
    body = put.json()
    assert body["configured"] is True
    assert body["settings"]["ttsEnabled"] is False
    assert body["settings"]["speechLanguage"] == "en-US"
    assert body["settings"]["spacePttMode"] == "hold"
    assert body["settings"]["defaultWorksetId"] == "__user__"
    assert "Tracy" in body["settings"]["ttsVoiceUri"]
    stored_voice = await _ui_pref_payload(app.state.db, "assistant_voice_io_settings")
    assert stored_voice is not None and "ttsEnabled" in stored_voice
    assert await get_config(app.state.db, "assistant_voice_io_settings") == ""

    put_toggle = await client.put(
        "/api/v1/ui-prefs/assistant/voice-io",
        json={
            "settings": {
                "sttProvider": "browser",
                "ttsProvider": "browser",
                "ttsEnabled": False,
                "speechLanguage": "en-US",
                "spacePttMode": "toggle",
                "defaultWorksetId": "memo-task-1",
            }
        },
    )
    assert put_toggle.status_code == 200
    assert put_toggle.json()["settings"]["spacePttMode"] == "toggle"
    assert put_toggle.json()["settings"]["defaultWorksetId"] == "memo-task-1"


async def test_timeline_annotations_roundtrip_and_sanitize(client, app) -> None:
    empty = await client.get("/api/v1/ui-prefs/timeline/annotations")
    assert empty.status_code == 200
    assert empty.json() == {
        "configured": False,
        "eventStatuses": None,
        "eventTimeOverrides": None,
    }

    put = await client.put(
        "/api/v1/ui-prefs/timeline/annotations",
        json={
            "eventStatuses": {
                "evt-1": "confirmed",
                "evt-bad": "nope",
                "": "pending",
            },
            "eventTimeOverrides": {
                "evt-1": {
                    "startTime": "2026-07-24T10:00:00Z",
                    "endTime": "2026-07-24T11:00:00Z",
                },
                "evt-2": {
                    "startTime": "not-iso",
                    "endTime": None,
                },
                "evt-3": {
                    "startTime": "2026-07-24T12:00:00Z",
                    "endTime": None,
                },
            },
        },
    )
    assert put.status_code == 200
    body = put.json()
    assert body["configured"] is True
    assert body["eventStatuses"] == {"evt-1": "confirmed"}
    assert body["eventTimeOverrides"] == {
        "evt-1": {
            "startTime": "2026-07-24T10:00:00Z",
            "endTime": "2026-07-24T11:00:00Z",
        },
        "evt-3": {
            "startTime": "2026-07-24T12:00:00Z",
            "endTime": None,
        },
    }
    stored = await _ui_pref_payload(app.state.db, "timeline_annotations")
    assert stored is not None and "evt-1" in stored
    assert await get_config(app.state.db, "timeline_annotations") == ""

    again = await client.get("/api/v1/ui-prefs/timeline/annotations")
    assert again.status_code == 200
    assert again.json()["eventStatuses"]["evt-1"] == "confirmed"

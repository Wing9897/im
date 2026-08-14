"""UI prefs voice-reminder sanitize + API."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from server.config import get_config
from server.tests.ui_prefs_helpers import ui_pref_payload
from server.ui_prefs import (
    KEY_VOICE_REMINDER_FIRED,
    KEY_VOICE_REMINDER_SETTINGS,
    KEY_VOICE_REMINDER_TRIGGER_HISTORY,
    MAX_PREF_JSON_CHARS,
    MAX_VOICE_HISTORY_ENTRIES,
    sanitize_fired_keys,
    sanitize_voice_history,
    sanitize_voice_settings,
)


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
    now = datetime(2026, 7, 24, tzinfo=UTC)
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
    stored = await ui_pref_payload(app.state.db, KEY_VOICE_REMINDER_SETTINGS)
    assert stored is not None
    assert '"enabled":true' in stored.replace(" ", "")
    assert await get_config(app.state.db, KEY_VOICE_REMINDER_SETTINGS) == ""


async def test_voice_fired_claim_dedupes_across_clients(client, app) -> None:
    now = datetime.now(UTC)
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

    now = datetime.now(UTC)
    fresh = (now - timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
    stale = (now - timedelta(days=10)).strftime("%Y-%m-%dT%H:%M:%SZ")
    put = await client.put(
        "/api/v1/ui-prefs/voice-reminder/fired",
        json={"keys": [f"e1::60::{fresh}", f"e2::15::{stale}", "bad"]},
    )
    assert put.status_code == 200
    assert put.json()["configured"] is True
    assert put.json()["keys"] == [f"e1::60::{fresh}"]
    stored = await ui_pref_payload(app.state.db, KEY_VOICE_REMINDER_FIRED)
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
    stored = await ui_pref_payload(app.state.db, KEY_VOICE_REMINDER_TRIGGER_HISTORY)
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

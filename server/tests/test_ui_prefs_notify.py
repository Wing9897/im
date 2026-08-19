"""UI prefs local-notify sanitize + API."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from server.config import get_config
from server.tests.ui_prefs_helpers import ui_pref_payload
from server.ui_prefs import (
    KEY_NOTIFY_FIRED,
    KEY_NOTIFY_SETTINGS,
    KEY_NOTIFY_TRIGGER_HISTORY,
    MAX_PREF_JSON_CHARS,
    MAX_NOTIFY_HISTORY_ENTRIES,
    sanitize_fired_keys,
    sanitize_notify_history,
    sanitize_notify_settings,
)


def test_sanitize_notify_settings_defaults_and_leads() -> None:
    clean = sanitize_notify_settings(
        {
            "enabled": True,
            "leadOffsetsMinutes": [60, 15, 0, 15, 10081, 30],
            "unknownKey": {"nested": True},
            "preambleChimeId": "soft-bell",
            "quietHours": {"enabled": False, "start": "bad", "end": "08:30"},
        }
    )
    assert clean["enabled"] is True
    assert clean["voiceEnabled"] is True
    assert clean["flashEnabled"] is True
    assert clean["flashMode"] == "timed"
    assert clean["leadOffsetsMinutes"] == [15, 30, 60]
    assert "unknownKey" not in clean
    assert clean["preambleChimeId"] == "broadcast"
    assert clean["quietHours"] == {"enabled": False, "start": "22:00", "end": "08:30"}

    missing = sanitize_notify_settings({"enabled": False})
    assert missing["voiceEnabled"] is True
    assert missing["flashEnabled"] is True
    assert missing["flashMode"] == "timed"
    split = sanitize_notify_settings({"enabled": True, "voiceEnabled": False, "flashEnabled": True})
    assert split["voiceEnabled"] is False
    assert split["flashEnabled"] is True
    persist = sanitize_notify_settings({"flashMode": "persistent"})
    assert persist["flashMode"] == "persistent"
    assert sanitize_notify_settings({"flashMode": "nope"})["flashMode"] == "timed"
    dropped = sanitize_notify_settings({"enabled": True, "mystery": 1})
    assert "mystery" not in dropped


def test_sanitize_notify_history_caps_at_100() -> None:
    rows = [
        {
            "id": f"id-{i}",
            "triggerReason": f"r{i}",
            "status": "success",
            "errorMessage": None,
            "triggeredAt": "2026-07-24T00:00:00Z",
        }
        for i in range(MAX_NOTIFY_HISTORY_ENTRIES + 25)
    ]
    clean = sanitize_notify_history(rows)
    assert len(clean) == MAX_NOTIFY_HISTORY_ENTRIES
    assert clean[0]["id"] == "id-0"
    assert clean[-1]["id"] == f"id-{MAX_NOTIFY_HISTORY_ENTRIES - 1}"


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


async def test_notify_settings_empty_and_roundtrip(client, app) -> None:
    empty = await client.get("/api/v1/ui-prefs/notify/settings")
    assert empty.status_code == 200
    assert empty.json() == {"configured": False, "settings": None}

    put = await client.put(
        "/api/v1/ui-prefs/notify/settings",
        json={
            "settings": {
                "enabled": True,
                "voiceEnabled": False,
                "flashEnabled": True,
                "flashMode": "persistent",
                "leadOffsetsMinutes": [30, 15],
                "preambleChimeId": "airport",
                "quietHours": {"enabled": True, "start": "23:00", "end": "06:00"},
            }
        },
    )
    assert put.status_code == 200
    settings = put.json()["settings"]
    assert settings["enabled"] is True
    assert settings["voiceEnabled"] is False
    assert settings["flashEnabled"] is True
    assert settings["flashMode"] == "persistent"
    assert settings["leadOffsetsMinutes"] == [15, 30]
    assert settings["preambleChimeId"] == "airport"
    stored = await ui_pref_payload(app.state.db, KEY_NOTIFY_SETTINGS)
    assert stored is not None
    assert '"enabled":true' in stored.replace(" ", "")
    assert await get_config(app.state.db, KEY_NOTIFY_SETTINGS) == ""


async def test_notify_fired_claim_dedupes_across_clients(client, app) -> None:
    now = datetime.now(UTC)
    fresh = (now + timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
    key = f"ev-1::60::{fresh}"
    first = await client.post(
        "/api/v1/ui-prefs/notify/fired/claim",
        json={"keys": [key]},
    )
    assert first.status_code == 200
    body = first.json()
    assert body["claimed"] == [key]
    assert key in body["keys"]

    second = await client.post(
        "/api/v1/ui-prefs/notify/fired/claim",
        json={"keys": [key]},
    )
    assert second.status_code == 200
    assert second.json()["claimed"] == []


async def test_notify_fired_empty_roundtrip_and_prune(client, app) -> None:
    empty = await client.get("/api/v1/ui-prefs/notify/fired")
    assert empty.status_code == 200
    assert empty.json() == {"configured": False, "keys": None}

    now = datetime.now(UTC)
    fresh = (now - timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ")
    stale = (now - timedelta(days=10)).strftime("%Y-%m-%dT%H:%M:%SZ")
    put = await client.put(
        "/api/v1/ui-prefs/notify/fired",
        json={"keys": [f"e1::60::{fresh}", f"e2::15::{stale}", "bad"]},
    )
    assert put.status_code == 200
    assert put.json()["configured"] is True
    assert put.json()["keys"] == [f"e1::60::{fresh}"]
    stored = await ui_pref_payload(app.state.db, KEY_NOTIFY_FIRED)
    assert stored is not None
    assert "e1::60::" in stored
    assert "e2::15::" not in stored


async def test_notify_history_empty_roundtrip_and_truncate(client, app) -> None:
    empty = await client.get("/api/v1/ui-prefs/notify/history")
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
        for i in range(MAX_NOTIFY_HISTORY_ENTRIES + 10)
    ]
    put = await client.put(
        "/api/v1/ui-prefs/notify/history",
        json={"entries": entries},
    )
    assert put.status_code == 200
    body = put.json()
    assert body["configured"] is True
    assert len(body["entries"]) == MAX_NOTIFY_HISTORY_ENTRIES
    assert body["entries"][0]["id"] == "h-0"
    stored = await ui_pref_payload(app.state.db, KEY_NOTIFY_TRIGGER_HISTORY)
    assert stored is not None and stored.startswith("[")


async def test_notify_history_oversized_payload_422(client) -> None:
    # One huge reason string forces the encoded JSON over the cap.
    huge = "x" * (MAX_PREF_JSON_CHARS)
    resp = await client.put(
        "/api/v1/ui-prefs/notify/history",
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


async def test_retired_voice_reminder_paths_are_404(client) -> None:
    """Stamp 37: ``/ui-prefs/voice-reminder/*`` is gone; SoT is ``/ui-prefs/notify/*``."""
    for path in (
        "/api/v1/ui-prefs/voice-reminder/settings",
        "/api/v1/ui-prefs/voice-reminder/fired",
        "/api/v1/ui-prefs/voice-reminder/history",
    ):
        resp = await client.get(path)
        assert resp.status_code == 404

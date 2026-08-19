"""UI prefs assistant sessions + voice-io."""

from __future__ import annotations

from server.config import get_config
from server.tests.ui_prefs_helpers import ui_pref_payload
from server.ui_prefs import sanitize_assistant_voice_io

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
        "SELECT payload_json FROM ui_prefs WHERE key = ?",
        (f"assistant_sessions:{DEVICE_A}",),
    )
    assert row is not None
    stored = str(row["payload_json"])
    assert "asst-1" not in stored
    assert "asst-2" in stored
    assert await get_config(app.state.db, "assistant_sessions") == ""


async def test_assistant_sessions_persist_llm_profile_id(client) -> None:
    put = await client.put(
        "/api/v1/ui-prefs/assistant/sessions",
        json={
            "deviceId": DEVICE_A,
            "sessions": [
                {
                    "id": "asst-profile",
                    "title": "Ollama chat",
                    "updatedAt": 100,
                    "messages": [],
                    "llmProfileId": "profile-ollama-1",
                },
                {
                    "id": "asst-follow",
                    "title": "Follow staff",
                    "updatedAt": 90,
                    "messages": [],
                    "llmProfileId": "   ",
                },
            ],
            "activeSessionId": "asst-profile",
        },
    )
    assert put.status_code == 200
    by_id = {s["id"]: s for s in put.json()["sessions"]}
    assert by_id["asst-profile"]["llmProfileId"] == "profile-ollama-1"
    assert not by_id["asst-follow"].get("llmProfileId")

    got = await client.get(
        "/api/v1/ui-prefs/assistant/sessions",
        params={"deviceId": DEVICE_A},
    )
    assert got.status_code == 200
    again = {s["id"]: s for s in got.json()["sessions"]}
    assert again["asst-profile"]["llmProfileId"] == "profile-ollama-1"
    assert not again["asst-follow"].get("llmProfileId")


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
    assert body["settings"]["defaultWorksetId"] == "__general__"
    assert "Tracy" in body["settings"]["ttsVoiceUri"]
    stored_voice = await ui_pref_payload(app.state.db, "assistant_voice_io_settings")
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


def test_sanitize_assistant_voice_io_migrates_reserved_providers() -> None:
    clean = sanitize_assistant_voice_io(
        {
            "sttProvider": "whisper",
            "ttsProvider": "doubao",
            "ttsEnabled": True,
            "speechLanguage": "zh-HK",
        }
    )
    assert clean["sttProvider"] == "browser"
    assert clean["ttsProvider"] == "browser"

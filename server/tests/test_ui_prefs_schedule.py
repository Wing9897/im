"""UI prefs schedule emoji map sanitize + API."""

from __future__ import annotations

from server.config import get_config
from server.tests.ui_prefs_helpers import ui_pref_payload
from server.ui_prefs import sanitize_schedule_emojis


def test_sanitize_schedule_emojis_drops_invalid_entries() -> None:
    clean = sanitize_schedule_emojis(
        {
            "emojis": {
                "oneOff:evt-1": "📅",
                "recurring:rec-1": "🔁",
                "": "❌",
                "bad key": "❌",
                "too-long": "x" * 80,
                "not-str": 12,
            },
            "noise": True,
        }
    )
    assert clean["emojis"] == {
        "oneOff:evt-1": "📅",
        "recurring:rec-1": "🔁",
    }


async def test_schedule_emojis_roundtrip(client, app) -> None:
    empty = await client.get("/api/v1/ui-prefs/schedule/emojis")
    assert empty.status_code == 200
    assert empty.json() == {"configured": False, "emojis": None}

    put = await client.put(
        "/api/v1/ui-prefs/schedule/emojis",
        json={"emojis": {"oneOff:evt-1": "🎉", "recurring:rec-1": "🔁"}},
    )
    assert put.status_code == 200
    body = put.json()
    assert body["configured"] is True
    assert body["emojis"] == {"oneOff:evt-1": "🎉", "recurring:rec-1": "🔁"}
    stored = await ui_pref_payload(app.state.db, "schedule_emojis")
    assert stored is not None and "oneOff:evt-1" in stored
    assert await get_config(app.state.db, "schedule_emojis") == ""

    again = await client.get("/api/v1/ui-prefs/schedule/emojis")
    assert again.status_code == 200
    assert again.json()["emojis"]["oneOff:evt-1"] == "🎉"


async def test_schedule_emojis_clear_glyph(client) -> None:
    await client.put(
        "/api/v1/ui-prefs/schedule/emojis",
        json={"emojis": {"oneOff:evt-1": "🎉"}},
    )
    cleared = await client.put("/api/v1/ui-prefs/schedule/emojis", json={"emojis": {}})
    assert cleared.status_code == 200
    assert cleared.json()["emojis"] == {}

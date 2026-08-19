"""UI prefs task emoji map sanitize + API (ui_prefs.task_emojis, not a schema column)."""

from __future__ import annotations

from server.config import get_config
from server.tests.ui_prefs_helpers import ui_pref_payload
from server.ui_prefs import sanitize_task_emojis


def test_sanitize_task_emojis_drops_invalid_entries() -> None:
    clean = sanitize_task_emojis(
        {
            "emojis": {
                "task-1": "🎯",
                "task-2": "📌",
                "": "❌",
                "bad key": "❌",
                "too-long": "x" * 80,
                "not-str": 12,
            },
            "noise": True,
        }
    )
    assert clean["emojis"] == {
        "task-1": "🎯",
        "task-2": "📌",
    }


async def test_task_emojis_roundtrip(client, app) -> None:
    empty = await client.get("/api/v1/ui-prefs/tasks/emojis")
    assert empty.status_code == 200
    assert empty.json() == {"configured": False, "emojis": None}

    put = await client.put(
        "/api/v1/ui-prefs/tasks/emojis",
        json={"emojis": {"task-1": "🎯", "task-2": "📌"}},
    )
    assert put.status_code == 200
    body = put.json()
    assert body["configured"] is True
    assert body["emojis"] == {"task-1": "🎯", "task-2": "📌"}
    stored = await ui_pref_payload(app.state.db, "task_emojis")
    assert stored is not None and "task-1" in stored
    assert await get_config(app.state.db, "task_emojis") == ""

    again = await client.get("/api/v1/ui-prefs/tasks/emojis")
    assert again.status_code == 200
    assert again.json()["emojis"]["task-1"] == "🎯"


async def test_task_emojis_clear_glyph(client) -> None:
    await client.put(
        "/api/v1/ui-prefs/tasks/emojis",
        json={"emojis": {"task-1": "🎯"}},
    )
    cleared = await client.put("/api/v1/ui-prefs/tasks/emojis", json={"emojis": {}})
    assert cleared.status_code == 200
    assert cleared.json()["emojis"] == {}

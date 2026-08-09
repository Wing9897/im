"""UI prefs timeline annotations sanitize + API."""

from __future__ import annotations

from server.config import get_config
from server.tests.ui_prefs_helpers import ui_pref_payload
from server.ui_prefs import sanitize_timeline_annotations


def test_sanitize_timeline_annotations_drops_invalid_entries() -> None:
    clean = sanitize_timeline_annotations(
        {
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
        }
    )
    assert clean["eventStatuses"] == {"evt-1": "confirmed"}
    assert clean["eventTimeOverrides"] == {
        "evt-1": {
            "startTime": "2026-07-24T10:00:00Z",
            "endTime": "2026-07-24T11:00:00Z",
        },
        "evt-3": {
            "startTime": "2026-07-24T12:00:00Z",
            "endTime": None,
        },
    }


async def test_timeline_annotations_roundtrip(client, app) -> None:
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
            "eventStatuses": {"evt-1": "confirmed"},
            "eventTimeOverrides": {
                "evt-1": {
                    "startTime": "2026-07-24T10:00:00Z",
                    "endTime": "2026-07-24T11:00:00Z",
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
    stored = await ui_pref_payload(app.state.db, "timeline_annotations")
    assert stored is not None and "evt-1" in stored
    assert await get_config(app.state.db, "timeline_annotations") == ""

    again = await client.get("/api/v1/ui-prefs/timeline/annotations")
    assert again.status_code == 200
    assert again.json()["eventStatuses"]["evt-1"] == "confirmed"


async def test_timeline_annotations_reject_invalid_status(client) -> None:
    put = await client.put(
        "/api/v1/ui-prefs/timeline/annotations",
        json={"eventStatuses": {"evt-bad": "nope"}, "eventTimeOverrides": {}},
    )
    assert put.status_code == 422
    assert put.json()["error_code"] == "VALIDATION_ERROR"

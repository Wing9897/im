"""UI prefs wire shapes and GET contract keys."""

from __future__ import annotations

import pytest

from server.api.schemas.responses.ui_prefs import (
    AssistantSessionsPutBody,
    BoardPrefsPutBody,
    BoardPrefsResponse,
    NotifyHistoryEntrySchema,
    TimelineAnnotationsPutBody,
)
from server.config import CONFIG_DEFAULTS
from server.tests.contract_helpers import assert_keys
from server.ui_prefs import UI_PREF_KEYS


def test_ui_prefs_pydantic_shapes_are_concrete() -> None:
    """Response/PUT models expose nested fields (no loose dict/Any blobs)."""
    board = BoardPrefsResponse.model_json_schema()
    nested = board.get("$defs", {})
    assert "BoardLayoutSchema" in nested
    assert "BoardWidgetStateSchema" in nested
    assert "layout" in board["properties"]
    assert BoardPrefsPutBody.model_json_schema().get("additionalProperties") is False
    sessions_put = AssistantSessionsPutBody.model_json_schema()
    assert {"deviceId", "sessions"} <= set(sessions_put["properties"])
    session_defs = sessions_put.get("$defs", {})
    session_schema = session_defs.get("AssistantSessionSchema") or {}
    # Prefer nested $defs; fall back to properties → items $ref resolution via inline.
    if not session_schema:
        # Pydantic may inline as AssistantSessionSchema under $defs with Input/Output split.
        session_schema = next(
            (
                value
                for key, value in session_defs.items()
                if "AssistantSession" in key and isinstance(value, dict) and "properties" in value
            ),
            {},
        )
    assert "llmProfileId" in session_schema.get("properties", {})
    timeline_put = TimelineAnnotationsPutBody.model_json_schema()
    assert {"eventStatuses", "eventTimeOverrides"} <= set(timeline_put["properties"])
    history = NotifyHistoryEntrySchema.model_json_schema()
    assert history["properties"]["status"]["enum"] == ["success", "failure"]


@pytest.mark.parametrize(
    ("path", "params", "response_keys"),
    [
        ("/api/v1/ui-prefs/board", None, ["configured", "layout", "widgetState"]),
        ("/api/v1/ui-prefs/notify/settings", None, ["configured", "settings"]),
        ("/api/v1/ui-prefs/notify/fired", None, ["configured", "keys"]),
        ("/api/v1/ui-prefs/notify/history", None, ["configured", "entries"]),
        (
            "/api/v1/ui-prefs/assistant/sessions",
            {"deviceId": "contract-device"},
            ["configured", "sessions", "activeSessionId"],
        ),
        ("/api/v1/ui-prefs/assistant/voice-io", None, ["configured", "settings"]),
        (
            "/api/v1/ui-prefs/timeline/annotations",
            None,
            ["configured", "eventStatuses", "eventTimeOverrides"],
        ),
    ],
)
async def test_ui_prefs_get_response_keys(client, path, params, response_keys) -> None:
    response = await client.get(path, params=params)
    assert response.status_code == 200
    assert_keys(response.json(), response_keys, path)


def test_ui_pref_keys_retired_from_config_defaults() -> None:
    for key in UI_PREF_KEYS:
        assert key not in CONFIG_DEFAULTS

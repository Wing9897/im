"""Public response and structured-error contract for UI preferences."""

from __future__ import annotations

import pytest

from server.tests.contract_helpers import assert_keys

ERROR_KEYS = ["error_code", "message", "details", "correlation_id"]


@pytest.mark.parametrize(
    ("path", "params", "response_keys"),
    [
        ("/api/v1/ui-prefs/board", None, ["configured", "layout", "widgetState"]),
        (
            "/api/v1/ui-prefs/voice-reminder/settings",
            None,
            ["configured", "settings"],
        ),
        (
            "/api/v1/ui-prefs/voice-reminder/fired",
            None,
            ["configured", "keys"],
        ),
        (
            "/api/v1/ui-prefs/voice-reminder/history",
            None,
            ["configured", "entries"],
        ),
        (
            "/api/v1/ui-prefs/assistant/sessions",
            {"deviceId": "contract-device"},
            ["configured", "sessions", "activeSessionId"],
        ),
        (
            "/api/v1/ui-prefs/assistant/voice-io",
            None,
            ["configured", "settings"],
        ),
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


@pytest.mark.parametrize(
    ("path", "payload"),
    [
        ("/api/v1/ui-prefs/board", {"unknown": {}}),
        ("/api/v1/ui-prefs/assistant/sessions", {"sessions": []}),
        ("/api/v1/ui-prefs/timeline/annotations", []),
    ],
)
async def test_ui_prefs_validation_errors_are_structured(client, path, payload) -> None:
    response = await client.put(path, json=payload)

    assert response.status_code == 422
    body = response.json()
    assert_keys(body, ERROR_KEYS, path)
    assert body["error_code"] == "VALIDATION_ERROR"

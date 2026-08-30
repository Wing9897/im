"""Calendar-share HTTP key contract: household auto-sync path and wire keys."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from server.api.schemas.requests.calendar_share import CalendarSharePublishAutoSyncBody
from server.api.schemas.responses.calendar_share import CalendarSharePublishListResponse
from server.config import CONFIG_DEFAULTS
from server.tests.calendar_share_fakes import login_calendar_share
from server.tests.contract_helpers import assert_keys

_REPO_ROOT = Path(__file__).resolve().parents[2]
_OPENAPI_PATH = _REPO_ROOT / "web" / "openapi" / "openapi.json"

HOUSEHOLD_AUTO_SYNC_PATH = "/api/v1/calendar-share/publish/auto-sync"
STALE_WORKSET_AUTO_SYNC_PATH = "/api/v1/calendar-share/publish/{workset_id}/auto-sync"

PUBLISH_LIST_KEYS = [
    "items",
    "autoSync",
    "autoSyncIntervalSeconds",
    "autoSyncIntervalFloorSeconds",
]

CALENDAR_SHARE_INTERNAL_CONFIG_KEYS = (
    "calendar_share_auto_sync",
    "calendar_share_auto_sync_interval_seconds",
)


def test_openapi_uses_household_auto_sync_path() -> None:
    paths = json.loads(_OPENAPI_PATH.read_text(encoding="utf-8"))["paths"]
    assert HOUSEHOLD_AUTO_SYNC_PATH in paths
    assert "patch" in paths[HOUSEHOLD_AUTO_SYNC_PATH]
    assert STALE_WORKSET_AUTO_SYNC_PATH not in paths


def test_auto_sync_request_and_list_response_keys() -> None:
    assert set(CalendarSharePublishAutoSyncBody.model_fields) == {
        "autoSync",
        "autoSyncIntervalSeconds",
    }
    assert set(CalendarSharePublishListResponse.model_fields) == set(PUBLISH_LIST_KEYS)


def test_household_auto_sync_keys_stay_off_settings_wire() -> None:
    from server.api.routes.config import _SETTINGS_KEYS
    from server.api.schemas.responses import SystemSettingsSnapshot

    snapshot_keys = set(SystemSettingsSnapshot.model_fields)
    settings_config_keys = set(_SETTINGS_KEYS.values())
    for key in CALENDAR_SHARE_INTERNAL_CONFIG_KEYS:
        assert key in CONFIG_DEFAULTS
        assert key not in settings_config_keys
        assert key not in snapshot_keys
        assert "autoSync" not in snapshot_keys


@pytest.mark.asyncio
async def test_publish_list_and_patch_auto_sync_http_keys(client, fake_remote) -> None:
    await login_calendar_share(client, fake_remote)
    listed = await client.get("/api/v1/calendar-share/publish")
    assert listed.status_code == 200, listed.text
    assert_keys(listed.json(), PUBLISH_LIST_KEYS, "CalendarSharePublishListResponse")

    patched = await client.patch(HOUSEHOLD_AUTO_SYNC_PATH, json={"autoSync": True})
    assert patched.status_code == 200, patched.text
    assert_keys(patched.json(), PUBLISH_LIST_KEYS, "PATCH auto-sync")

    stale = await client.patch(
        "/api/v1/calendar-share/publish/ws-1/auto-sync",
        json={"autoSync": True},
    )
    assert stale.status_code in (404, 405)

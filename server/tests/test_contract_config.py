"""Contract keys: config routes (settings snapshot / API key)."""

from __future__ import annotations

from server.api.routes.config import _SETTINGS_KEYS
from server.api.schemas.responses import SystemSettingsSnapshot
from server.config import CONFIG_DEFAULTS, get_config
from server.secrets import MASKED_SECRET
from server.tests.contract_helpers import assert_keys

#: Wire keys — single source is ``_SETTINGS_KEYS`` in config routes.
SETTINGS_KEYS = list(_SETTINGS_KEYS)

_INTERNAL_CONFIG_KEYS = frozenset(
    {
        "localhost_auth_exempt",
        "setup_complete",
        # Project tick knobs — server-owned; not on SystemSettingsSnapshot yet.
        "agent_project_max_tool_rounds",
        "agent_project_max_drain_waves",
    }
)

#: Retired config keys (removed implementations) that must stay retired.
_RETIRED_CONFIG_KEYS = frozenset(
    {
        "analysis_spatiotemporal_mode",
        "auto_pause_on_rate_limit",
        "data_retention_days",
        # Schema v9: household keys live in access_api_keys table (hash-only).
        "ingestion_api_key",
        "access_api_keys",
        # Stamp 5: device-scoped assistant sessions live in ui_prefs.
        "assistant_sessions",
        # Board / voice / timeline / assistant voice-io live in ui_prefs (wipe-only).
        "ops_board_layout",
        "ops_board_widget_state",
        "voice_reminder_settings",
        "voice_reminder_fired",
        "voice_reminder_trigger_history",
        "assistant_voice_io_settings",
        "timeline_annotations",
        # Per-task scheduling columns are task-owned; no longer system_config globals.
        "batch_overlap_count",
        "agent_project_wave_interval_seconds",
    }
)


def test_settings_keys_align_across_config_api_and_response_model():
    api_config_keys = set(_SETTINGS_KEYS.values())
    snapshot_keys = set(SystemSettingsSnapshot.model_fields)

    assert snapshot_keys == set(SETTINGS_KEYS)

    for key in _RETIRED_CONFIG_KEYS:
        assert key not in CONFIG_DEFAULTS

    for config_key in api_config_keys:
        assert config_key in CONFIG_DEFAULTS, f"missing CONFIG_DEFAULTS entry for {config_key}"

    exposed_defaults = set(CONFIG_DEFAULTS) - _INTERNAL_CONFIG_KEYS
    assert api_config_keys == exposed_defaults


async def test_settings_snapshot_and_roundtrip(client):
    resp = await client.get("/api/v1/config/settings")
    snapshot = resp.json()
    assert_keys(snapshot, SETTINGS_KEYS, "SystemSettingsSnapshot")
    assert isinstance(snapshot["analysisPaused"], bool)
    assert isinstance(snapshot["analysisTraceVerbose"], bool)
    assert isinstance(snapshot["autoPauseOnRetriesExhausted"], bool)
    assert isinstance(snapshot["ollamaThinkingEnabled"], bool)
    assert isinstance(snapshot["assistantWebSearchEnabled"], bool)
    assert snapshot["webSearchProvider"] in {"auto", "duckduckgo", "brave"}
    assert "braveSearchApiKey" in snapshot
    assert "autoPauseOnRateLimit" not in snapshot
    assert isinstance(snapshot["maxConcurrentBatches"], str)

    snapshot["ollamaModel"] = "qwen3:8b"
    snapshot["maxConcurrentBatches"] = "3"
    saved = (await client.put("/api/v1/config/settings", json=snapshot)).json()
    assert saved["ollamaModel"] == "qwen3:8b"
    assert saved["maxConcurrentBatches"] == "3"

    again = (await client.get("/api/v1/config/settings")).json()
    assert again["ollamaModel"] == "qwen3:8b"
    assert again["maxConcurrentBatches"] == "3"
    assert "dataRetentionDays" not in again
    assert "retentionMessagesDays" in again
    assert again["uiLocale"] == "zh-Hant"


async def test_ui_locale_settings_roundtrip(client):
    before = (await client.get("/api/v1/config/settings")).json()
    assert before["uiLocale"] == "zh-Hant"

    saved = (await client.put("/api/v1/config/settings", json={**before, "uiLocale": "en"})).json()
    assert saved["uiLocale"] == "en"

    again = (await client.get("/api/v1/config/settings")).json()
    assert again["uiLocale"] == "en"

    # Invalid tokens normalize to zh-Hant
    normalized = (await client.put("/api/v1/config/settings", json={**again, "uiLocale": "fr"})).json()
    assert normalized["uiLocale"] == "zh-Hant"

    # Client preference ``auto`` is not a valid server uiLocale
    rejected_auto = (await client.put("/api/v1/config/settings", json={**again, "uiLocale": "auto"})).json()
    assert rejected_auto["uiLocale"] == "zh-Hant"


async def test_trigger_threshold_and_batch_limit_independent_roundtrip(client):
    """Trigger threshold (min to start) and batch limit (max per batch) persist separately."""
    before = (await client.get("/api/v1/config/settings")).json()
    payload = {
        **before,
        "analysisTriggerThreshold": "1",
        "analysisBatchMessageLimit": "50",
    }
    saved = (await client.put("/api/v1/config/settings", json=payload)).json()
    assert saved["analysisTriggerThreshold"] == "1"
    assert saved["analysisBatchMessageLimit"] == "50"

    again = (await client.get("/api/v1/config/settings")).json()
    assert again["analysisTriggerThreshold"] == "1"
    assert again["analysisBatchMessageLimit"] == "50"


async def test_settings_put_ignores_analysis_paused(client):
    """analysisPaused is read-only on PUT /settings; use POST /system/analysis/pause."""
    before = (await client.get("/api/v1/config/settings")).json()
    assert before["analysisPaused"] is False

    await client.post(
        "/api/v1/system/analysis/pause",
        json={"paused": True},
    )
    paused = (await client.get("/api/v1/config/settings")).json()
    assert paused["analysisPaused"] is True

    # Stale snapshot with analysisPaused=false must not resume scheduler.
    stale = {**paused, "analysisPaused": False}
    saved = (await client.put("/api/v1/config/settings", json=stale)).json()
    assert saved["analysisPaused"] is True

    again = (await client.get("/api/v1/config/settings")).json()
    assert again["analysisPaused"] is True


async def test_settings_put_ignores_unknown_data_retention_days(client, app):
    """Retired dataRetentionDays wire key is ignored on PUT and absent from GET."""
    before = (await client.get("/api/v1/config/settings")).json()
    messages = before["retentionMessagesDays"]
    probe = "1" if messages != "1" else "2"

    saved = (
        await client.put(
            "/api/v1/config/settings",
            json={**before, "dataRetentionDays": probe},
        )
    ).json()
    assert "dataRetentionDays" not in saved
    assert saved["retentionMessagesDays"] == messages
    stored = await app.state.db.fetch_value("SELECT COUNT(*) FROM system_config WHERE key = 'data_retention_days'")
    assert stored == 0


async def test_secret_settings_are_masked_and_preserved(client, app):
    saved = (
        await client.put(
            "/api/v1/config/settings",
            json={"openaiApiKey": "sk-never-return-this"},
        )
    ).json()
    assert saved["openaiApiKey"] == MASKED_SECRET

    raw = await app.state.db.fetch_value("SELECT value FROM system_config WHERE key = 'openai_api_key'")
    assert str(raw).startswith("enc:v1:")
    assert "sk-never-return-this" not in str(raw)

    await client.put(
        "/api/v1/config/settings",
        json={"openaiApiKey": MASKED_SECRET, "openaiModel": "gpt-test"},
    )
    assert await get_config(app.state.db, "openai_api_key") == "sk-never-return-this"


async def test_assistant_identity_settings_roundtrip(client):
    before = (await client.get("/api/v1/config/settings")).json()
    assert before["assistantDisplayName"] == ""
    assert before["assistantAvatar"] == ""

    avatar = "data:image/jpeg;base64,abc123"
    saved = (
        await client.put(
            "/api/v1/config/settings",
            json={
                **before,
                "assistantDisplayName": "  Helix  ",
                "assistantAvatar": avatar,
            },
        )
    ).json()
    assert saved["assistantDisplayName"] == "Helix"
    assert saved["assistantAvatar"] == avatar

    again = (await client.get("/api/v1/config/settings")).json()
    assert again["assistantDisplayName"] == "Helix"
    assert again["assistantAvatar"] == avatar

    # Invalid avatar (not a data URL) is ignored; previous value kept.
    rejected = (
        await client.put(
            "/api/v1/config/settings",
            json={**again, "assistantAvatar": "https://example.com/x.png"},
        )
    ).json()
    assert rejected["assistantAvatar"] == avatar

    cleared = (
        await client.put(
            "/api/v1/config/settings",
            json={**again, "assistantDisplayName": "", "assistantAvatar": ""},
        )
    ).json()
    assert cleared["assistantDisplayName"] == ""
    assert cleared["assistantAvatar"] == ""


async def test_user_profile_settings_roundtrip(client):
    before = (await client.get("/api/v1/config/settings")).json()
    assert before["userDisplayName"] == ""
    assert before["userAvatar"] == ""
    assert before["userBackground"] == ""

    avatar = "data:image/jpeg;base64,useravatar"
    saved = (
        await client.put(
            "/api/v1/config/settings",
            json={
                **before,
                "userDisplayName": "  Wing  ",
                "userAvatar": avatar,
                "userBackground": "  Ops lead  ",
            },
        )
    ).json()
    assert saved["userDisplayName"] == "Wing"
    assert saved["userAvatar"] == avatar
    assert saved["userBackground"] == "  Ops lead  "

    again = (await client.get("/api/v1/config/settings")).json()
    assert again["userDisplayName"] == "Wing"
    assert again["userAvatar"] == avatar
    assert again["userBackground"] == "  Ops lead  "

    rejected = (
        await client.put(
            "/api/v1/config/settings",
            json={**again, "userAvatar": "https://example.com/x.png"},
        )
    ).json()
    assert rejected["userAvatar"] == avatar

    cleared = (
        await client.put(
            "/api/v1/config/settings",
            json={
                **again,
                "userDisplayName": "",
                "userAvatar": "",
                "userBackground": "",
            },
        )
    ).json()
    assert cleared["userDisplayName"] == ""
    assert cleared["userAvatar"] == ""
    assert cleared["userBackground"] == ""


def test_gemini_default_base_url_matches_config_contract():
    """llm_client fallback and frontend preset must align with CONFIG_DEFAULTS."""
    assert CONFIG_DEFAULTS["gemini_base_url"] == "https://generativelanguage.googleapis.com/v1beta"
